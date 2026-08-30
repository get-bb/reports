import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { highlightMarkdownCode } from "./markdown-code-highlight.js";

const diff = [
  "diff --git a/config.ini b/config.ini",
  "--- a/config.ini",
  "+++ b/config.ini",
  "@@ -1 +1 @@",
  "-enabled=false",
  "+enabled=true",
].join("\n");

const stylesheet = readFileSync(
  new URL("./markdown-code-highlight.css", import.meta.url),
  "utf8",
);

describe("Markdown diff line styles", () => {
  it("styles every semantic line class emitted by the diff highlighter", () => {
    const html = highlightMarkdownCode({ code: diff, language: "diff" });
    const roles = ["add", "remove", "hunk", "meta"];

    for (const role of roles) {
      expect(html).toContain(`sh__line--diff-${role}`);
      expect(stylesheet).toContain(`.sh__line--diff-${role}`);
    }
  });
});
