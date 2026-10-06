import { expect, it } from "vitest";
import { createCodexEventTranslator } from "./translator.js";

it("retains asynchronous question choices through provider translation", () => {
  const translator = createCodexEventTranslator({
    additionalWorkspaceWriteRoots: [],
  });
  const deltas = translator.translateEvent({
    jsonrpc: "2.0",
    method: "item/completed",
    params: {
      threadId: "codex-question-repro",
      turnId: "turn-question-repro",
      item: {
        type: "agentMessage",
        id: "question-region",
        text: "Select a deployment region.",
        phase: "final_answer",
        memoryCitation: null,
        delivery: "async",
        questions: [
          {
            title: "Select a deployment region.",
            options: ["East region", "West region"],
          },
        ],
      },
    },
  });

  console.log(JSON.stringify(deltas, null, 2));
  expect(deltas).not.toEqual([]);
  expect(JSON.stringify(deltas)).toContain("East region");
  expect(JSON.stringify(deltas)).toContain("West region");
});
