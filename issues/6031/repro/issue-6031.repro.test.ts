import { describe, expect, it } from "vitest";
import { planAcpElicitation } from "./elicitation.js";

function planFormatQuestion() {
  const plan = planAcpElicitation({
    mode: "form",
    message: "Choose the response format",
    requestedSchema: {
      type: "object",
      required: ["format"],
      properties: {
        format: {
          type: "string",
          title: "Response format",
          enum: ["brief", "detailed"],
        },
        format__other: { type: "string", title: "Custom format" },
      },
    },
  });
  if (plan.kind !== "questions") {
    throw new Error(JSON.stringify(plan));
  }
  return plan;
}

describe("issue 6031 trusted-base reproduction", () => {
  it("records the split and refusal when the optional text property is omitted", () => {
    const plan = planFormatQuestion();
    const withoutCompanion = plan.toResponse({
      kind: "user_answer",
      answers: { format: { selected: ["brief"] } },
    });
    const withCompanion = plan.toResponse({
      kind: "user_answer",
      answers: {
        format: { selected: ["brief"] },
        format__other: { selected: [], freeText: "outline" },
      },
    });
    const observed = {
      questions: plan.payload.questions.map((question) => ({
        id: question.id,
        allowFreeText: question.allowFreeText,
        options: question.options?.map((option) => option.value) ?? [],
      })),
      withoutCompanion,
      withCompanion,
    };
    console.log(JSON.stringify(observed, null, 2));
    expect(observed).toEqual({
      questions: [
        { id: "format", allowFreeText: false, options: ["brief", "detailed"] },
        { id: "format__other", allowFreeText: true, options: [] },
      ],
      withoutCompanion: { action: "decline" },
      withCompanion: {
        action: "accept",
        content: { format: "brief", format__other: "outline" },
      },
    });
  });

  it("regression: presents the choice and companion as one free-text-capable question", () => {
    const plan = planFormatQuestion();
    expect(plan.payload.questions).toHaveLength(1);
    expect(plan.payload.questions[0]).toMatchObject({
      id: "format",
      allowFreeText: true,
    });
  });

  it("keeps a standalone text property as its own question", () => {
    const plan = planAcpElicitation({
      mode: "form",
      requestedSchema: {
        type: "object",
        properties: { notes__other: { type: "string" } },
      },
    });
    expect(plan.kind).toBe("questions");
    if (plan.kind !== "questions") {
      throw new Error(JSON.stringify(plan));
    }
    expect(plan.payload.questions).toHaveLength(1);
    expect(
      plan.toResponse({
        kind: "user_answer",
        answers: { notes__other: { selected: [], freeText: "follow up" } },
      }),
    ).toEqual({ action: "accept", content: { notes__other: "follow up" } });
  });
});
