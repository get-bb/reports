import { expect, it } from "vitest";
import type { AvailableModel } from "@bb/domain";
import { resolveModelCatalogSelection } from "./model-catalog-selection";
import { buildExecutionInputSources } from "./selection-state";

const model = (name: string, isDefault = false): AvailableModel => ({
  id: name,
  model: name,
  displayName: name,
  description: "",
  supportedReasoningEfforts: [],
  defaultReasoningEffort: "medium",
  isDefault,
});

it("preserves the current model and its implicit source after a catalog refresh", () => {
  const current = model("chosen-model[1m]");
  const fallback = model("catalog-default", true);
  const select = (models: AvailableModel[]) => resolveModelCatalogSelection({
    models,
    selectedOnlyModels: [],
    selectedModel: current.model,
    preferredReasoningLevel: "medium",
    provider: undefined,
    catalogIsVerified: true,
    formatModelLabel: (label) => label,
  });
  expect(select([current, fallback]).selectedModel).toBe(current.model);
  const refreshed = select([model("chosen-model"), fallback]);
  const sources = buildExecutionInputSources({
    effectiveValues: {
      selectedProviderId: "test-provider",
      selectedModel: refreshed.selectedModel,
      serviceTier: undefined,
      reasoningLevel: refreshed.reasoningLevel,
      permissionMode: "full",
    },
    forceExplicitModel: refreshed.isUnavailableModelRecovery,
    scope: "component-local",
    storedValues: {
      selectedProviderId: "",
      selectedModel: "",
      serviceTier: "",
      reasoningLevel: "",
      permissionMode: "",
    },
    touchedFields: new Set(),
  });
  expect({
    selectedModel: refreshed.selectedModel,
    modelSource: sources.model,
  }).toEqual({
    selectedModel: current.model,
    modelSource: undefined,
  });
});
