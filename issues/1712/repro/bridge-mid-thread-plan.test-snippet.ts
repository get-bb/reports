  // Regression for #1712: `/plan` sent on a LATER turn of a live session. The
  // server puts `claudeCodePermissionMode: "plan"` in providerOptions on
  // turn/start, but the bridge only ever applied the permission mode at
  // session construction. The mention was stripped from the prompt and the
  // prompt was pushed into a session still in the user's preset mode, so
  // Claude never entered Plan mode and never called ExitPlanMode.
  it("switches a live session into Plan mode when a later turn carries /plan", async () => {
    const bridge = createBridgeJsonRpcTestHarness(handleLine);
    const queries: ControlledClaudeQuery[] = [];
    queryMock.mockImplementation(() => {
      const query = createControlledClaudeQuery();
      queries.push(query);
      return query;
    });

    try {
      const threadId = "thread-plan-mid-conversation";
      // Turn 1: a normal accept-edits session (no plan mode).
      await startBridgeThread({ bridge, threadId });
      const query = queries[0];
      const call = getLatestQueryCall();
      if (!query) {
        throw new Error("Expected live Claude query");
      }
      expect(call.options.permissionMode).toBe("acceptEdits");

      // Turn 2: the user types "/plan ..." into the existing thread. The
      // server strips nothing; it forwards the mention plus the plan knob.
      bridge.sendRequest(
        2,
        "turn/start",
        canonicalTurnParams({
          threadId,
          input: [
            {
              type: "text",
              text: "/plan Create hello.txt containing hello world",
              mentions: [
                {
                  start: 0,
                  end: 5,
                  resource: {
                    kind: "command",
                    trigger: "/",
                    name: "plan",
                    source: "command",
                    origin: "builtin",
                    label: "plan",
                    argumentHint: null,
                  },
                },
              ],
            },
          ],
          providerOptions: { claudeCodePermissionMode: "plan" },
        }),
      );
      await bridge.waitForResponse(2);
      const prompt = await readNextPromptText(call);

      // The `/plan` token is stripped (correct: the CLI would treat it as a
      // second command) ...
      expect(prompt).toBe("Create hello.txt containing hello world");
      // ... so the ONLY thing that can put the session into Plan mode is the
      // live permission-mode switch. On the base commit this is never called.
      expect(query.setPermissionMode).toHaveBeenCalledWith("plan");
      // No session rebuild either — the same query stays live.
      expect(queries).toHaveLength(1);
      expect(query.close).not.toHaveBeenCalled();

      await stopBridgeThread({ bridge, queries, threadId });
    } finally {
      bridge.restore();
    }
  });

