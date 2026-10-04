import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, it, vi } from "vitest";
import type {
  HostDaemonInjectedSkillSource,
  HostDaemonSkillTree,
} from "@bb/host-daemon-contract";
import { stageInjectedSkillSources } from "./injected-skills.js";

const skillText =
  "---\nname: rename-probe\ndescription: Rename probe.\n---\n\nprobe bytes\n";
const skillBytes = Buffer.from(skillText);
const treeHash = createHash("sha256")
  .update("bb-skill-tree-v1\0file\0SKILL.md\0")
  .update("644\0")
  .update(String(skillBytes.length))
  .update("\0")
  .update(skillBytes)
  .digest("hex");
const tree: HostDaemonSkillTree = {
  treeHash,
  entries: [
    {
      path: "SKILL.md",
      mode: 0o644,
      contentBase64: skillBytes.toString("base64"),
    },
  ],
};

it.each([
  ["skill-store", "transient"],
  ["global-skills", "transient"],
  ["skill-store", "collision"],
  ["global-skills", "collision"],
] as const)(
  "publishes %s despite a modeled Windows %s rename denial",
  async (root, failure) => {
    const dataDir = await fs.mkdtemp(path.join(tmpdir(), "bb-4865-probe-"));
    const nativeRename = fs.rename;
    const denial = Object.assign(
      new Error("Modeled directory publication denial"),
      { code: "EPERM" },
    );
    let denials = 0;
    let renameAttempts = 0;
    const rename = vi
      .spyOn(fs, "rename")
      .mockImplementation(async (from, to) => {
        if (path.basename(path.dirname(String(from))) === root) {
          renameAttempts += 1;
          if (denials === 0) {
            denials += 1;
            if (failure === "collision") {
              await fs.cp(from, to, { recursive: true });
            }
            throw denial;
          }
        }
        await nativeRename(from, to);
      });
    try {
      const sourceRootPath = path.join(dataDir, "source");
      await fs.mkdir(sourceRootPath);
      await fs.writeFile(path.join(sourceRootPath, "SKILL.md"), skillBytes);
      const source: HostDaemonInjectedSkillSource =
        root === "skill-store"
          ? {
              kind: "tree",
              sourceType: "data-dir",
              name: "rename-probe",
              description: "Rename probe.",
              treeHash,
              entryPath: "SKILL.md",
            }
          : {
              kind: "workspace-path",
              sourceType: "project",
              name: "rename-probe",
              description: "Rename probe.",
              sourceRootPath,
              skillFilePath: path.join(sourceRootPath, "SKILL.md"),
            };
      const stage = () =>
        stageInjectedSkillSources({
          dataDir,
          injectedSkillSources: [source],
          fetchSkillTree: async () => tree,
          logger: { warn: () => undefined },
        });
      const first = await stage().then(
        () => "fulfilled",
        (error: unknown) =>
          error === denial ? "rejected: EPERM" : "rejected: unexpected error",
      );
      const firstRenameAttempts = renameAttempts;
      const remainingTemps = (
        await fs.readdir(path.join(dataDir, "runtime", root))
      ).filter((name) => name.startsWith(".tmp-"));
      const second = await stage();
      const publishedText = await fs.readFile(
        path.join(second.skillRoots[0]!.path, "rename-probe", "SKILL.md"),
        "utf8",
      );
      console.info(
        JSON.stringify({
          root,
          failure,
          first,
          firstRenameAttempts,
          remainingTemps: remainingTemps.length,
          resubmission:
            publishedText === skillText
              ? "published intact bytes"
              : "wrong bytes",
        }),
      );
      expect(publishedText).toBe(skillText);
      expect(first).toBe("fulfilled");
    } finally {
      rename.mockRestore();
      await fs.rm(dataDir, { recursive: true, force: true });
    }
  },
);
