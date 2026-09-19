import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, it, vi } from "vitest";
import { pipeline } from "./pipeline.js";

it("lists only the configured Claude user skills directory", async () => {
  const homeDir = await mkdtemp(path.join(tmpdir(), "bb-relocated-skills-"));
  try {
    const configuredDir = path.join(homeDir, "configured");
    for (const [directory, name] of [
      [path.join(homeDir, ".claude"), "default-root-skill"],
      [configuredDir, "configured-root-skill"],
    ] as const) {
      const skillDir = path.join(directory, "skills", name);
      await mkdir(skillDir, { recursive: true });
      await writeFile(
        path.join(skillDir, "SKILL.md"),
        `---\nname: ${name}\ndescription: Test skill\n---\nTest content.\n`,
      );
    }
    vi.stubEnv("CLAUDE_CONFIG_DIR", configuredDir);
    const relocated = await pipeline({
      providerId: "claude-code",
      cwd: null,
      homeDir,
    });
    expect(relocated.skills.map((skill) => skill.name).sort()).toEqual([
      "configured-root-skill",
    ]);
    vi.stubEnv("CLAUDE_CONFIG_DIR", "");
    const defaults = await pipeline({
      providerId: "claude-code",
      cwd: null,
      homeDir,
    });
    expect(defaults.skills.map((skill) => skill.name)).toEqual([
      "default-root-skill",
    ]);
  } finally {
    vi.unstubAllEnvs();
    await rm(homeDir, { recursive: true, force: true });
  }
});
