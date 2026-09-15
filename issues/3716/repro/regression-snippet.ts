
describe("concurrent idle dispatch regression", () => {
  it("retains every concurrent queue-mode send", async () => {
    await withTestHarness(async (harness) => {
      const { thread } = seedProviderThreadFixture({ harness, value: 3716 });
      const results = await Promise.allSettled(
        Array.from({ length: 4 }, (_, index) =>
          acceptThreadSendRequest(harness.deps, {
            thread,
            payload: {
              input: textInput(`concurrent message ${index}`),
              mode: "queue-if-active",
              model: "gpt-5",
              permissionMode: "full",
              reasoningLevel: "medium",
              serviceTier: "default",
            },
          }),
        ),
      );
      expect(results.map((result) => result.status === "rejected" ? String(result.reason) : result.status), `queued=${listQueuedThreadMessages(harness.db, thread.id).length}; commands=${listQueuedThreadCommands(harness, "turn.submit", thread.id).length}`).toEqual(
        Array.from({ length: 4 }, () => "fulfilled"),
      );
      expect(listQueuedThreadMessages(harness.db, thread.id)).toHaveLength(3);
    });
  });
});
