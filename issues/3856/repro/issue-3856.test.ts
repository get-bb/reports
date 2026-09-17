import { mkdtemp, mkdir, writeFile, symlink, rm, realpath } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, it } from "vitest";
import { discoverProviderCommands, type CommandScanRoot } from "./command-discovery.js";

it("discovers an internal project directory alias with real and user controls", async () => {
  const workspace = await mkdtemp(path.join(tmpdir(), "skill-discovery-"));
  try {
    const catalog = path.join(workspace, "catalog");
    const provider = path.join(workspace, "provider");
    await mkdir(path.join(catalog, "sample"), { recursive: true });
    await mkdir(provider);
    await writeFile(path.join(catalog, "sample", "SKILL.md"), "# Sample\n");
    await symlink(path.join(catalog, "sample"), path.join(provider, "sample"), "dir");
    expect(await realpath(path.join(provider, "sample"))).toBe(path.join(await realpath(workspace), "catalog", "sample"));
    const scan = (rootPath: string, origin: "project" | "user") => {
      const root: CommandScanRoot = { rootPath, origin, shape: "skill", source: "skill", namePrefix: "", boundaryPath: workspace };
      return discoverProviderCommands({ roots: [root] });
    };
    const direct = await scan(catalog, "project");
    const user = await scan(provider, "user");
    const project = await scan(provider, "project");
    console.log(JSON.stringify({ direct: direct.map(x => x.name), user: user.map(x => x.name), project: project.map(x => x.name) }));
    expect(direct.map(x => x.name)).toEqual(["sample"]);
    expect(user.map(x => x.name)).toEqual(["sample"]);
    expect(project.map(x => x.name)).toEqual(["sample"]);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});
