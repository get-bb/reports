/**
 * Repro for get-bb/bb#1688: Cursor Grok 4.6 is hidden from the primary
 * model picker.
 *
 * Feeds real `cursor-agent --list-models` output (Cursor CLI 2026.08.11)
 * through the same pipeline the ACP bridge uses for `model/list`
 * (parseAgentModelLines -> buildAgentModelCatalog -> splitPrimaryModels)
 * with the built-in acp-cursor primaryModels policy. On main the Grok 4.6
 * family lands in `selectedOnlyModels` because the policy still names the
 * Grok 4.5 family id.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BUILT_IN_ACP_LAUNCH_SPECS } from "../../../../packages/agent-runtime/src/acp-launch-specs.js";
import {
  buildAgentModelCatalog,
  parseAgentModelLines,
  splitPrimaryModels,
} from "./model-catalog.js";

// Captured with `cursor-agent --list-models` (2026.08.11-e8db854).
const CURSOR_LIST_MODELS = readFileSync(
  new URL("./issue-1688-cursor-list-models.txt", import.meta.url),
  "utf8",
);

describe("issue #1688: Cursor Grok 4.6 primary placement", () => {
  const primaryModels =
    BUILT_IN_ACP_LAUNCH_SPECS["acp-cursor"].modelCli!.primaryModels;
  const catalog = buildAgentModelCatalog(
    parseAgentModelLines(CURSOR_LIST_MODELS),
  )!;
  const split = splitPrimaryModels(catalog.models, primaryModels);

  it("folds the Grok 4.6 variants into one family keyed by cursor-grok-4.6-medium", () => {
    const grok46 = catalog.models.find(
      (m) => m.displayName === "Cursor Grok 4.6",
    );
    expect(grok46?.id).toBe("cursor-grok-4.6-medium");
    expect(
      grok46?.supportedReasoningEfforts.map((e) => e.reasoningEffort),
    ).toEqual(["low", "medium", "high", "xhigh"]);
  });

  it("puts Cursor Grok 4.6 in the primary (default picker) list", () => {
    const primaryIds = split.models.map((m) => m.id);
    const selectedOnlyIds = split.selectedOnlyModels.map((m) => m.id);
    // Sanity: the older Grok family is primary today.
    expect(primaryIds).toContain("cursor-grok-4.5-medium");
    // BUG on main: Grok 4.6 is selected-only, not primary.
    expect(selectedOnlyIds).not.toContain("cursor-grok-4.6-medium");
    expect(primaryIds).toContain("cursor-grok-4.6-medium");
  });
});
