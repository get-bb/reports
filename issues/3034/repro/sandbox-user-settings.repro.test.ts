import { afterEach, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildSessionOptions } from "../session-options.js";

const tempDirs: string[] = [];

afterEach(() => {
  for (const directory of tempDirs.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

describe("Claude workspace sandbox user settings", () => {
  it("preserves the user allowWrite paths when adding bb write roots", () => {
    const homeDir = mkdtempSync(join(tmpdir(), "bb-claude-settings-"));
    tempDirs.push(homeDir);
    const settingsDir = join(homeDir, ".claude");
    const userCache = join(homeDir, "cache");
    const bbWriteRoot = join(homeDir, "thread-storage");
    mkdirSync(settingsDir);
    writeFileSync(
      join(settingsDir, "settings.json"),
      JSON.stringify({
        sandbox: { filesystem: { allowWrite: [userCache] } },
      }),
    );

    const options = buildSessionOptions(
      {
        additionalWorkspaceWriteRoots: [bbWriteRoot],
        chromeEnabled: false,
        cwd: join(homeDir, "workspace"),
        getPermissionEscalation: () => "deny",
        instructionMode: "append",
        permissionMode: "auto",
        permissionScope: "workspace",
        workflowsEnabled: false,
      },
      { HOME: homeDir, PATH: "" },
    );

    expect(options.sandbox?.filesystem?.allowWrite).toEqual([
      userCache,
      bbWriteRoot,
    ]);
  });
});
