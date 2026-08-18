import { describe, expect, it } from "vitest";

import {
  parseLocalFileHref,
  resolveRelativeLocalFileHref,
} from "./markdown-local-file-link";

// Repro for get-bb/bb#1182: a chat link whose href starts with `~/` is treated
// as workspace-relative and joined onto the workspace root.
const workspaceRootPath = "/Users/me/bb";

describe("issue #1182: home-relative hrefs", () => {
  it.each([
    ["~"],
    ["~/.config/example.md"],
    ["%7E/.config/example.md"],
    ["~/.config/example.md:12"],
    ["~/notes.md#L3-L5"],
    ["~alice/notes.md"],
  ])("leaves %s as plain text (not a workspace file)", (href) => {
    const resolved = resolveRelativeLocalFileHref({
      baseDir: workspaceRootPath,
      href,
      rootPath: workspaceRootPath,
    });
    // BUG on 16ceb3a54: this returns "/Users/me/bb/~/.config/example.md"
    expect(resolved).toBeNull();
  });

  // Guard against over-rejecting: a file whose *name* merely starts with `~`
  // is a legitimate relative path and must stay a workspace file. These pass
  // on 16ceb3a54 and must keep passing after the fix.
  it.each([
    ["~notes.md", "/Users/me/bb/~notes.md"],
    ["~$report.docx", "/Users/me/bb/~$report.docx"],
    ["~notes.md:3", "/Users/me/bb/~notes.md:3"],
    ["docs/~draft.md", "/Users/me/bb/docs/~draft.md"],
  ])("still resolves %s as a workspace file", (href, expected) => {
    expect(
      resolveRelativeLocalFileHref({
        baseDir: workspaceRootPath,
        href,
        rootPath: workspaceRootPath,
      }),
    ).toBe(expected);
  });

  it("documents the actual (buggy) behaviour on 16ceb3a54", () => {
    const resolved = resolveRelativeLocalFileHref({
      baseDir: workspaceRootPath,
      href: "~/.config/example.md",
      rootPath: workspaceRootPath,
    });
    // This is what the app currently produces; it then passes the
    // "contained in root" check and opens a workspace file tab.
    const link = parseLocalFileHref({
      absoluteLinks: { kind: "contained", rootPath: workspaceRootPath },
      href: resolved ?? "",
    });
    // eslint-disable-next-line no-console
    console.log("resolved href:", resolved, "-> workspace link:", link);
    expect(link?.path).not.toBe("/Users/me/bb/~/.config/example.md");
  });
});
