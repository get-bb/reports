import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const inheritedPath = "/usr/bin:/bin:/usr/sbin:/sbin";
const fixtureDir = mkdtempSync(join(tmpdir(), "bb-2343-shell-"));
const toolDir = join(fixtureDir, "user-tools");
const shellPath = join(fixtureDir, "slow-login-shell");
const shellPidFile = join(fixtureDir, "shell-pids");
const childPidFile = join(fixtureDir, "child-pids");
const recoveredPath = `${toolDir}:${inheritedPath}`;
const childPids = new Set<number>();

function writeExecutable(path: string, contents: string): void {
  writeFileSync(path, contents);
  chmodSync(path, 0o755);
}

function readPids(path: string): number[] {
  return readFileSync(path, "utf8")
    .trim()
    .split("\n")
    .map((value) => Number.parseInt(value, 10));
}

function processIsAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function runTool(
  env: NodeJS.ProcessEnv,
  command: "gh" | "node",
): { status: number | null; stderr: string; stdout: string } {
  const result = spawnSync("/usr/bin/env", [command, "--version"], {
    encoding: "utf8",
    env,
  });
  return {
    status: result.status,
    stderr: result.stderr.trim(),
    stdout: result.stdout.trim(),
  };
}

async function main(): Promise<void> {
  try {
    mkdirSync(toolDir);
    writeExecutable(join(toolDir, "node"), "#!/bin/sh\nprintf 'stub-node-ok\\n'\n");
    writeExecutable(join(toolDir, "gh"), "#!/bin/sh\nprintf 'stub-gh-ok\\n'\n");
    writeExecutable(
      shellPath,
      `#!/bin/bash\nprintf '%s\\n' "$$" >> '${shellPidFile}'\nsleep 30 &\nprintf '%s\\n' "$!" >> '${childPidFile}'\nprintf '%s' '${recoveredPath}'\nexit 0\n`,
    );

    const rawStartedAt = Date.now();
    const rawProbe = spawnSync(shellPath, ["-ilc", 'printf "%s" "$PATH"'], {
      encoding: "utf8",
      timeout: 2_000,
    });
    const rawElapsedMs = Date.now() - rawStartedAt;
    const firstShellPid = readPids(shellPidFile)[0];
    const firstChildPid = readPids(childPidFile)[0];
    childPids.add(firstChildPid);

    const moduleUrl = pathToFileURL(
      resolve(process.cwd(), "apps/desktop/src/desktop-shell-path.ts"),
    ).href;
    const { ensurePackagedUserShellPath } = await import(moduleUrl);
    const bbProcessModuleUrl = pathToFileURL(
      resolve(process.cwd(), "apps/desktop/src/bb-process.ts"),
    ).href;
    const { createBbAppProcessLaunch } = await import(bbProcessModuleUrl);
    const warnings: string[] = [];
    const env: NodeJS.ProcessEnv = { PATH: inheritedPath, SHELL: shellPath };
    const productionStartedAt = Date.now();
    const result = ensurePackagedUserShellPath({
      env,
      isPackaged: true,
      logger: { warn: (message: string) => warnings.push(message) },
      platform: "linux",
    });
    const productionElapsedMs = Date.now() - productionStartedAt;
    for (const pid of readPids(childPidFile)) {
      childPids.add(pid);
    }

    const runtime = {
      executablePath: "/Applications/bb.app/Contents/MacOS/bb",
      kind: "direct" as const,
      mode: "electron-node" as const,
    };
    const failedLaunch = createBbAppProcessLaunch({
      bridgePath: "/Applications/bb.app/Contents/Resources/bb-app.js",
      env,
      runtime,
    });
    const controlLaunch = createBbAppProcessLaunch({
      bridgePath: "/Applications/bb.app/Contents/Resources/bb-app.js",
      env: { PATH: recoveredPath },
      runtime,
    });
    const failedNode = runTool(failedLaunch.env, "node");
    const failedGh = runTool(failedLaunch.env, "gh");
    const controlNode = runTool(controlLaunch.env, "node");
    const controlGh = runTool(controlLaunch.env, "gh");

    const evidence = {
      rawProbe: {
        error: rawProbe.error?.message,
        signal: rawProbe.signal,
        status: rawProbe.status,
        stdout: rawProbe.stdout,
        elapsedMs: rawElapsedMs,
        shellPid: firstShellPid,
        shellAliveAfterTimeout: processIsAlive(firstShellPid),
        pipeHoldingChildPid: firstChildPid,
        pipeHoldingChildAliveAfterTimeout: processIsAlive(firstChildPid),
      },
      productionProbe: {
        elapsedMs: productionElapsedMs,
        result,
        warning: warnings[0],
      },
      paths: {
        inheritedPath,
        recoveredPath,
        actualPath: env.PATH,
        failedChildPath: failedLaunch.env.PATH,
        controlChildPath: controlLaunch.env.PATH,
      },
      inheritedPathCommands: { node: failedNode, gh: failedGh },
      recoveredPathControls: { node: controlNode, gh: controlGh },
    };
    process.stdout.write(`${JSON.stringify(evidence, null, 2)}\n`);

    assert.equal(rawProbe.status, 0);
    assert.equal(rawProbe.stdout, recoveredPath);
    assert.match(rawProbe.error?.message ?? "", /ETIMEDOUT/u);
    assert.equal(evidence.rawProbe.shellAliveAfterTimeout, false);
    assert.equal(evidence.rawProbe.pipeHoldingChildAliveAfterTimeout, true);
    assert.ok(rawElapsedMs >= 1_800 && rawElapsedMs < 4_000);
    assert.equal(result.kind, "unchanged");
    assert.equal(result.reason, "shell-error");
    assert.equal(env.PATH, inheritedPath);
    assert.equal(failedLaunch.env.PATH, inheritedPath);
    assert.match(warnings[0] ?? "", /ETIMEDOUT/u);
    assert.equal(failedNode.status, 127);
    assert.equal(failedGh.status, 127);
    assert.equal(controlNode.status, 0);
    assert.equal(controlNode.stdout, "stub-node-ok");
    assert.equal(controlGh.status, 0);
    assert.equal(controlGh.stdout, "stub-gh-ok");
  } finally {
    for (const pid of childPids) {
      try {
        process.kill(pid, "SIGTERM");
      } catch {
        // The child already exited.
      }
    }
    rmSync(fixtureDir, { force: true, recursive: true });
  }
}

void main();
