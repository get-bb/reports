import { describe, expect, it } from "vitest";
import { tokenize, SugarHigh } from "sugar-high";
import { diff } from "sugar-high/presets";

// Not a fix: an experiment showing that a v1-compatible shell preset is a
// ~10-line object, and how far it gets on the issue's sample.
const shell = {
  keywords: new Set([
    "if", "then", "else", "elif", "fi", "for", "in", "do", "done", "while",
    "until", "case", "esac", "function", "return", "export", "local", "source",
    "alias", "unset", "set", "shift", "exit", "cd", "echo", "eval", "exec",
  ]),
  onCommentStart: (curr: string) => (curr === "#" ? 1 : 0),
  onCommentEnd: (_prev: string, curr: string) => (curr === "\n" ? 1 : 0),
};

const named = (code: string, opts?: object) =>
  tokenize(code, opts).map(
    ([type, value]) => [SugarHigh.TokenTypes[type], value] as const,
  );

describe("#1751 fix idea: v1 shell preset", () => {
  it("lexes # comment as comment", () => {
    const t = named("# install the plugin\nbb plugin install ./plugins/monokai", shell);
    console.log(JSON.stringify(t));
    expect(t[0]).toEqual(["comment", "# install the plugin\n"]);
    // v1 core still lexes `/plugins/monokai` as a regex literal ("string"); a
    // preset cannot switch that heuristic off. sugar-high v2 shell does not.
    expect(t.filter(([ty]) => ty === "string")).toEqual([["string", "/plugins/monokai"]]);
  });
  it("shows how the JS lexer treats a ```diff fence today (no preset wired)", () => {
    const code = "--- a/x\n+++ b/x\n@@ -1 +1 @@\n-old line\n+new line";
    console.log("core:", JSON.stringify(named(code)));
    console.log("diff preset:", JSON.stringify(named(code, diff)));
  });
});
