import os from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";
import { browseHostDirectory } from "./host-files.js";

vi.mock("node:path", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:path")>();
  return { ...actual, default: actual.win32 };
});

vi.mock("node:fs/promises", () => {
  const directories = new Map([
    ["C:\\", ["Users"]],
    ["C:\\Users", ["Tester"]],
    ["C:\\Users\\Tester", ["Projects"]],
    ["G:\\", ["SharedProjects"]],
    ["H:\\", ["TeamProjects"]],
  ]);
  const children = (directory: string) => {
    const entries = directories.get(directory);
    if (!entries) {
      throw Object.assign(new Error("Fixture directory not found"), {
        code: "ENOENT",
      });
    }
    return entries;
  };
  return {
    default: {
      stat: async (directory: string) => {
        children(directory);
        return { isDirectory: () => true };
      },
      realpath: async (directory: string) => {
        children(directory);
        return directory;
      },
      readdir: async (directory: string) =>
        children(directory).map((name) => ({
          name,
          isSymbolicLink: () => false,
          isDirectory: () => true,
          isFile: () => false,
        })),
    },
  };
});

afterEach(() => vi.restoreAllMocks());

describe("issue 5358 controlled Windows directory navigation", () => {
  it("starts at home and stops at the current drive root", async () => {
    vi.spyOn(os, "homedir").mockReturnValue("C:\\Users\\Tester");
    const home = await browseHostDirectory({ type: "host.browse_directory" });
    expect(home.directory).toBe("C:\\Users\\Tester");
    const users = await browseHostDirectory({
      type: "host.browse_directory",
      path: home.parent!,
    });
    const root = await browseHostDirectory({
      type: "host.browse_directory",
      path: users.parent!,
    });
    console.log("ROOT_LISTING", JSON.stringify(root));
    expect(root.directory).toBe("C:\\");
    expect(root.parent).toBeNull();
    expect(root.entries.map((entry) => entry.name)).toEqual(["Users"]);
  });

  it.each(["G:\\", "H:\\"])(
    "can browse another drive when its path is explicitly provided: %s",
    async (directory) => {
      const result = await browseHostDirectory({
        type: "host.browse_directory",
        path: directory,
      });
      console.log("EXPLICIT_DRIVE", JSON.stringify(result));
      expect(result.directory).toBe(directory);
      expect(result.parent).toBeNull();
      expect(result.entries).toHaveLength(1);
    },
  );

  it("exposes available drive roots for click-only cross-drive navigation", async () => {
    const root = await browseHostDirectory({
      type: "host.browse_directory",
      path: "C:\\",
    });
    expect(root.entries.map((entry) => entry.path)).toEqual(
      expect.arrayContaining(["G:\\", "H:\\"]),
    );
  });
});
