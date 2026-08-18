// @vitest-environment jsdom
//
// Issue #1615: components map full arrays into small scroll surfaces. This
// test documents the *current* DOM footprint on main (it PASSES on main); a
// fix that virtualizes / windows these lists should make the expectations
// below FAIL and be rewritten to assert the bounded count.

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FilePreview } from "./FilePreview";
import { WorkspaceChangesList } from "@/components/thread/WorkspaceChangesList";
import type { WorkspaceChangedFile } from "@/components/thread/WorkspaceChangesList";

// Pierre (the syntax-highlighting worker) is irrelevant here; stub it like
// FilePreview.test.tsx does so the CSV "Raw" branch does not spin up workers.
vi.mock("@pierre/diffs/react", () => ({
  File: () => null,
  useWorkerPoolStats: () => ({}),
}));

afterEach(() => cleanup());

function csv(rows: number, cols: number): string {
  const header = Array.from({ length: cols }, (_, c) => `col_${c}`).join(",");
  const body = Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => `r${r}c${c}`).join(","),
  );
  return [header, ...body].join("\n");
}

describe("issue #1615: unbounded list rendering", () => {
  it("CSV preview mounts every cell of the 500x100 window (50,000 <td>)", () => {
    const { container } = render(
      <FilePreview
        path="data/big.csv"
        state={{
          kind: "ready",
          file: { name: "big.csv", contents: csv(600, 120) },
          lineRange: null,
          textPreviewKind: "csv",
        }}
      />,
    );
    const table = container.querySelector("table[aria-label$='CSV preview']");
    expect(table).not.toBeNull();
    // Truncation stops at 500 rows x 100 columns ...
    expect(table!.querySelectorAll("tbody tr")).toHaveLength(500);
    expect(table!.querySelectorAll("thead th")).toHaveLength(101);
    // ... but every one of the 50,000 cells is created up front, plus one
    // <span> per cell, for a scroll box that shows a few dozen cells.
    expect(table!.querySelectorAll("td")).toHaveLength(50_000);
    expect(table!.querySelectorAll("td > span")).toHaveLength(50_000);
    expect(table!.querySelectorAll("*").length).toBeGreaterThan(100_000);
  });

  it("WorkspaceChangesList without `limit` mounts one row per changed file", () => {
    const files: WorkspaceChangedFile[] = Array.from({ length: 5000 }, (_, i) => ({
      path: `manyfiles/file_${String(i).padStart(5, "0")}.txt`,
      status: "??",
      insertions: null,
      deletions: null,
    }));
    const { container } = render(
      <WorkspaceChangesList files={files} className="max-h-32" />,
    );
    // The prompt banner (ThreadPromptContextBanner) renders this list with
    // className="max-h-32 ..." and no `limit`, so all 5000 rows are in the DOM
    // behind a 128px-tall scroll box (and stay mounted while collapsed).
    expect(container.querySelectorAll("li")).toHaveLength(5000);
  });
});
