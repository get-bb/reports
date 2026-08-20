// @vitest-environment jsdom
// Repro for get-bb/bb#1778: `$$` opened at the start of a line with TeX on
// the same line and closed by a trailing `$$` at the end of a later line.
// `micromark-extension-math` treats this as a math *flow* fence whose
// closing fence must sit alone on its own line, so the block never closes
// and everything after it (heading, list, link) becomes math content.
import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MarkdownPreview } from "./markdown-preview";

afterEach(() => cleanup());

const ISSUE_BODY = [
  "Before the formula.",
  "",
  "$$T_{\\text{appearance}\\rightarrow\\text{chunk}}",
  "\\approx73\\text{--}146\\text{ ms}$$",
  "",
  "## Content after the formula",
  "",
  "- This should remain a list item.",
  "- [This should remain a link](https://example.com).",
].join("\n");

describe("issue #1778: trailing `$$` does not close a multiline math block", () => {
  it("keeps the heading, list and link after the formula as Markdown", async () => {
    const { container } = render(<MarkdownPreview content={ISSUE_BODY} />);

    // KaTeX is lazy-loaded; wait until it rendered *something* for the formula.
    await waitFor(() =>
      expect(container.querySelector(".katex, .katex-error")).not.toBeNull(),
    );

    // The structure after the formula must survive.
    expect(container.querySelector("h2")?.textContent).toBe(
      "Content after the formula",
    );
    expect(container.querySelectorAll("li")).toHaveLength(2);
    expect(
      container.querySelector('a[href="https://example.com"]')?.textContent,
    ).toBe("This should remain a link");

    // And no single katex-error may swallow the suffix.
    const errorText =
      container.querySelector(".katex-error")?.textContent ?? "";
    expect(errorText).not.toContain("Content after the formula");
  });
});
