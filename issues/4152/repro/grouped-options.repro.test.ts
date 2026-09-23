import { describe, expect, it } from "vitest";
import { acpSessionNewResultSchema } from "./wire.js";

const choices = [
  { value: "local-fast", name: "Local fast" },
  { value: "local-careful", name: "Local careful" },
];

function response(id: string, grouped: boolean) {
  return {
    sessionId: "grouping-check",
    configOptions: [
      {
        id,
        name: "Selection",
        type: "select",
        currentValue: choices[0].value,
        options: grouped
          ? [{ group: "local", name: "Local", options: choices }]
          : choices,
      },
    ],
  };
}

describe("grouped selection regression", () => {
  it("keeps flat model choices as a control", () => {
    const parsed = acpSessionNewResultSchema.parse(response("model", false));
    expect(parsed.configOptions?.[0].options).toEqual(choices);
  });

  it("accepts grouped model choices during session creation", () => {
    const parsed = acpSessionNewResultSchema.parse(response("model", true));
    expect(parsed.configOptions?.[0].options).toEqual(choices);
  });

  it("retains grouped choices for non-model settings", () => {
    const parsed = acpSessionNewResultSchema.parse(response("execution", true));
    expect(parsed.configOptions?.[0].options).toEqual(choices);
  });
});
