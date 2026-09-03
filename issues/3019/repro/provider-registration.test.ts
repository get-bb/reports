import { describe, expect, it } from "vitest";
import { acpProviderDeclaration } from "./declaration.js";
import { KNOWN_ACP_AGENTS } from "./known-agents.js";

describe("ACP plan capability reproduction", () => {
  it("exposes the plan composer action for an agent with a plan session mode", () => {
    const agent = KNOWN_ACP_AGENTS.find(
      (candidate) => candidate.id === "acp-omp",
    );
    expect(agent).toBeDefined();

    const declaration = acpProviderDeclaration(agent!);
    expect(declaration.composerActions).toContain("plan");
  });
});
