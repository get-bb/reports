import { expect, it } from "vitest";
import { buildAcpNativeReasoningSupport, buildModelCatalogFromConfigOptions, findAcpThoughtLevelConfigOption } from "./model-catalog.js";

it("records the missing-control fallback and preserves advertised levels", () => {
  const missing = buildAcpNativeReasoningSupport(findAcpThoughtLevelConfigOption([]));
  expect(missing.supportedReasoningEfforts.map(e => e.reasoningEffort)).toEqual(["medium"]);
  const advertised = buildAcpNativeReasoningSupport({
    id: "effort", category: "thought_level", type: "select", currentValue: "medium",
    options: ["low", "medium", "high", "xhigh"].map(value => ({ value })),
  });
  expect(advertised.supportedReasoningEfforts.map(e => e.reasoningEffort)).toEqual(["low", "medium", "high", "xhigh"]);
  const models = buildModelCatalogFromConfigOptions({
    id: "model", category: "model", type: "select", currentValue: "synthetic/a",
    options: [{value: "synthetic/a"}, {value: "synthetic/b"}],
  }, new Map([["synthetic/b", advertised]]));
  expect(models.map(m => m.supportedReasoningEfforts.map(e => e.reasoningEffort))).toEqual([["medium"], ["low", "medium", "high", "xhigh"]]);
  process.stdout.write("missing control: medium; unprobed model: medium; advertised control: low,medium,high,xhigh\n");
});
