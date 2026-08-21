// Repro for get-bb/bb#2062: the ACP bridge drops the per-option `description`
// an agent sends on its model config-option select, so two models that share a
// display name become indistinguishable downstream.
//
// Expected on a fixed tree: both assertions pass.
// Actual on fcada5a3b: the first assertion fails because every catalog entry
// carries description "" even though the agent sent one.
import { describe, expect, it } from "vitest";
import { acpSessionNewResultSchema } from "../wire.js";
import {
  buildModelCatalogFromConfigOptions,
  findAcpModelConfigOption,
} from "./model-catalog.js";

// Exactly what an omp-style agent returns from session/new: two providers
// expose the same display name; value and description differ.
const sessionNew = acpSessionNewResultSchema.parse({
  sessionId: "s1",
  configOptions: [
    {
      id: "model",
      name: "Model",
      category: "model",
      type: "select",
      currentValue: "zai/glm-4.7",
      options: [
        { value: "zai/glm-4.7", name: "GLM 4.7", description: "zai/glm-4.7" },
        {
          value: "openrouter/glm-4.7",
          name: "GLM 4.7",
          description: "openrouter/glm-4.7",
        },
      ],
    },
  ],
});

describe("#2062 ACP config-option model descriptions", () => {
  const models = buildModelCatalogFromConfigOptions(
    findAcpModelConfigOption(sessionNew.configOptions),
  );

  it("keeps the description the agent sent for each select option", () => {
    expect(models.map((m) => m.description)).toEqual([
      "zai/glm-4.7",
      "openrouter/glm-4.7",
    ]);
  });

  it("leaves two rows that differ only by id when descriptions are dropped", () => {
    // Documents the user-visible consequence: the only field the desktop
    // picker renders (displayName) is identical for both rows.
    const [a, b] = models;
    expect(a.displayName).toBe(b.displayName);
    expect(a.id).not.toBe(b.id);
  });
});
