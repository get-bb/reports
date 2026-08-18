import { describe, expect, it } from "vitest";
import { tokenize, SugarHigh } from "sugar-high";
import { highlightMarkdownCode } from "./markdown-code-highlight.js";

// Repro for get-bb/bb#1751: a ```sh / ```bash fence has no sugar-high preset,
// so it falls through to the JS/TS core lexer. `# install the plugin` becomes
// a `sign` + three `identifier`s instead of one `comment`.
const code = "# install the plugin\nbb plugin install ./plugins/monokai";

function tokenNames(html: string): string[] {
  return [...html.matchAll(/class="sh__token--(\w+)"/g)].map((m) => m[1]!);
}

describe("#1751 shell fences", () => {
  it("shows what sugar-high does with a shell comment (no preset -> JS lexer)", () => {
    const tokens = tokenize(code).map(
      ([type, value]) => [SugarHigh.TokenTypes[type], value] as const,
    );
    console.log(JSON.stringify(tokens));
    // JS lexer: '#' is a sign, words are identifiers; nothing is a comment.
    expect(tokens.find(([, v]) => v === "#")?.[0]).toBe("sign");
    expect(tokens.filter(([t]) => t === "comment")).toHaveLength(0);
  });

  it.each(["sh", "bash", "shell", "zsh", "console"])(
    "language=%s: `# comment` should lex as a comment (FAILS on main)",
    (language) => {
      const html = highlightMarkdownCode({ code, language });
      const names = tokenNames(html);
      // Expected: at least one comment token; actual on main: none, '#' is a sign.
      expect(names, `html was: ${html}`).toContain("comment");
    },
  );

  it("control: python fence lexes `# comment` as a comment", () => {
    const html = highlightMarkdownCode({ code, language: "python" });
    expect(tokenNames(html)).toContain("comment");
  });
});
