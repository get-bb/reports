import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { listPathsRecursively } from "./file-list.js";

describe("issue 2362", () => {
  it("lists a child directory with 130000 files", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "bb-2362-"));
    try {
      const child = path.join(root, "child");
      await fs.mkdir(child);
      const fileCount = 130_000;
      const batchSize = 500;
      for (let start = 0; start < fileCount; start += batchSize) {
        const end = Math.min(start + batchSize, fileCount);
        await Promise.all(
          Array.from({ length: end - start }, (_, offset) =>
            fs.writeFile(path.join(child, `f${start + offset}.txt`), ""),
          ),
        );
      }

      const result = await listPathsRecursively({
        dir: root,
        root,
        includeFiles: true,
        includeDirectories: false,
      });

      expect(result).toHaveLength(fileCount);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  }, 120_000);
});
