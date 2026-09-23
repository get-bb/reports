  it.each([false, true])("issue 4154 preserves later model efforts (reject middle: %s)", async (rejectMiddle) => {
    const log = join(workspaceDir, "probes.txt");
    const modelListId = sendModelList({
      agent: { command: process.execPath, args: [resolve(dirname(FAKE_AGENT_PATH), "issue-4154-agent.mjs")] },
      envVars: { REPRO_REQUEST_LOG: log, REPRO_REJECT_MIDDLE: rejectMiddle ? "1" : "0" },
    });
    const response = await waitForResponse(modelListId);
    const probed = readFileSync(log, "utf8").trim().split("\n");
    console.error(JSON.stringify({ rejectMiddle, probed, response }));
    expect(response.result).toMatchObject({
      models: [
        { id: "probe-a", supportedReasoningEfforts: [
          { reasoningEffort: "low" }, { reasoningEffort: "medium" }, { reasoningEffort: "high" },
        ] },
        { id: "probe-b", supportedReasoningEfforts: rejectMiddle
          ? [{ reasoningEffort: "medium" }]
          : [{ reasoningEffort: "low" }, { reasoningEffort: "medium" }, { reasoningEffort: "high" }] },
        { id: "probe-c", supportedReasoningEfforts: [
          { reasoningEffort: "low" }, { reasoningEffort: "medium" }, { reasoningEffort: "high" },
        ] },
      ],
    });
    expect(probed).toEqual(["probe-a", "probe-b", "probe-c"]);
  });

