import { expect, it } from "vitest";
import { formatModelLoadErrorText } from "./model-load-error-message";

it("gives the Codex login step when model discovery needs authentication", () => {
  const message = formatModelLoadErrorText({
    error: { providerId: "codex", code: "auth_required" },
    providerLabel: "Codex",
  });

  expect(message).toContain("codex login");
});
