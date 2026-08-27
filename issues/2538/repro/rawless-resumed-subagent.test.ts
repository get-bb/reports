// Add this test inside `describe("codex subagent activity correlation", ...)`
// in plugins/provider-codex/src/translator.test.ts at base commit
// ad79bbb5ec909524f8f281e62d860c588a86f332.
it("links a rawless resumed subagent when its child turn starts", () => {
  const harness = createHarness();

  expect(
    harness.translate(
      subAgentActivity({
        id: "synthetic-followup-call",
        kind: "interacted",
        agentThreadId: "synthetic-agent-thread",
      }),
    ),
  ).toEqual([]);

  const events = harness.translate(childTurnStarted("synthetic-child-turn"));
  expect(events).toContainEqual(
    expect.objectContaining({
      type: "item/started",
      item: expect.objectContaining({
        type: "delegation",
        childRef: "synthetic-agent-thread",
      }),
    }),
  );
  expect(events).toContainEqual(
    expect.objectContaining({
      type: "turn/started",
      parentToolCallId: harness.itemId("synthetic-followup-call"),
    }),
  );
});
