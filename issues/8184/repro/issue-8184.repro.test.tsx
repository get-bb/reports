// @vitest-environment jsdom

import { cleanup, render } from "@testing-library/react";
import type { Processor } from "unified";
import { afterEach, expect, it, vi } from "vitest";
import { MarkdownPreview } from "./markdown-preview";
import { MessageSlotRegistriesProvider } from "./message-markdown-slots";

const observed = vi.hoisted(() => ({ parserRuns: 0 }));

vi.mock("remark-gfm", async (importOriginal) => {
  const original = await importOriginal<typeof import("remark-gfm")>();
  return {
    ...original,
    default: function (
      this: Processor,
      ...options: Parameters<typeof original.default>
    ) {
      original.default.apply(this, options);
      const parser = this.parser;
      if (parser === undefined) {
        throw new Error("Expected the real remark parser to be installed");
      }
      this.parser = (...parameters) => {
        observed.parserRuns += 1;
        return parser(...parameters);
      };
    },
  };
});

afterEach(cleanup);

it("does not parse unchanged message text again after a timeline-style remount", () => {
  const content = [
    "# Lifecycle probe 8184",
    "A **complete** response with unchanged source.",
    "- Read the input\n- Render the result",
    "| Phase | State |\n| --- | --- |\n| First | Ready |",
  ].join("\n\n");
  const preview = (
    <MessageSlotRegistriesProvider>
      <MarkdownPreview
        content={content}
        incrementalBlocks
        tableLayout="contained"
      />
    </MessageSlotRegistriesProvider>
  );
  const first = render(preview);
  expect(first.container.querySelector("strong")?.textContent).toBe("complete");
  expect(first.container.querySelector("table")).not.toBeNull();
  const firstHtml = first.container.innerHTML;
  const firstRuns = observed.parserRuns;
  expect(firstRuns).toBe(1);
  first.rerender(preview);
  expect(observed.parserRuns).toBe(firstRuns);
  first.unmount();
  const second = render(preview);
  expect(second.container.innerHTML).toBe(firstHtml);
  console.log(
    JSON.stringify({
      firstMountParses: firstRuns,
      afterRemountParses: observed.parserRuns,
      identicalHtml: true,
    }),
  );
  expect(observed.parserRuns).toBe(firstRuns);
});
