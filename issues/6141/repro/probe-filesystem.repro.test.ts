import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { probeClaudeInitialization } from "./initialization-probe.js";

const require = createRequire(import.meta.url);
const sdkRequire = createRequire(require.resolve("@anthropic-ai/claude-agent-sdk"));
const executable = join(
  dirname(sdkRequire.resolve("@anthropic-ai/claude-agent-sdk-linux-x64/package.json")),
  "claude",
);
let scratch: string;
let preload: string;

beforeAll(async () => {
  scratch = await mkdtemp(join(tmpdir(), "bb-probe-6141-"));
  preload = join(scratch, "delay.so");
  execFileSync("cc", [
    "-shared",
    "-fPIC",
    "-o",
    preload,
    fileURLToPath(new URL("./probe-delay.c", import.meta.url)),
    "-ldl",
  ]);
});

afterAll(async () => {
  await rm(scratch, { recursive: true, force: true });
});

describe("initialization probe filesystem lifecycle", () => {
  it.each(["normal", "delayed"])(
    "leaves no config temporary files after the CLI exits (%s)",
    async (mode) => {
      const home = join(scratch, mode);
      await mkdir(home);
      const config = join(home, "config");
      await mkdir(config);
      const trace = join(home, "trace.txt");
      const gate = join(home, "delay-enabled");
      const initialization = await probeClaudeInitialization({
        cwd: home,
        env: {
          HOME: home,
          PATH: "/usr/bin:/bin",
          CLAUDE_CONFIG_DIR: config,
          BB_CLAUDE_CODE_EXECUTABLE: executable,
          CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1",
          LD_PRELOAD: preload,
          BB_PROBE_TRACE: trace,
          BB_PROBE_DELAY_GATE: gate,
        },
      });
      expect(initialization.models.length).toBeGreaterThan(0);
      if (mode === "delayed") await writeFile(gate, "enabled");
      const startup = await readFile(trace, "utf8");
      const match = /^started pid=(\d+)$/m.exec(startup);
      if (!match) throw new Error("Missing CLI startup evidence");
      const pid = Number(match[1]);
      await vi.waitFor(
        () => {
          expect(() => process.kill(pid, 0)).toThrow();
        },
        { timeout: 25_000, interval: 100 },
      );
      const events = await readFile(trace, "utf8");
      const leftovers = (await readdir(config)).filter((name) =>
        name.startsWith(".claude.json.tmp."),
      );
      console.log(
        JSON.stringify({ mode, modelCount: initialization.models.length, exited: true, events: events.trim().split("\n"), leftovers }),
      );
      if (mode === "delayed") expect(events).toContain("delayed-fsync-enter");
      expect(leftovers).toEqual([]);
    },
    40_000,
  );
});
