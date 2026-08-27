import { describe, expect, it } from "vitest";

import {
  buildAcpNativeReasoningSupport,
  findAcpThoughtLevelConfigOption,
} from "./model-catalog.js";

describe("issue #2503", () => {
  it("uses the effort ladder when Cursor returns Thinking before Effort", () => {
    const thinking = {
      id: "thinking",
      name: "Thinking",
      category: "thought_level",
      type: "select",
      currentValue: "true",
      options: [{ value: "true" }, { value: "false" }],
    };
    const effort = {
      id: "effort",
      name: "Effort",
      category: "thought_level",
      type: "select",
      currentValue: "medium",
      options: [
        { value: "none" },
        { value: "low" },
        { value: "medium" },
        { value: "high" },
        { value: "xhigh" },
        { value: "max" },
      ],
    };

    const selected = findAcpThoughtLevelConfigOption([thinking, effort]);
    const support = buildAcpNativeReasoningSupport(selected);

    expect({
      selectedId: selected?.id,
      levels: support.supportedReasoningEfforts.map(
        (entry) => entry.reasoningEffort,
      ),
    }).toEqual({
      selectedId: "effort",
      levels: ["none", "low", "medium", "high", "xhigh", "max"],
    });
  });
});
