  it("retains image blocks beside native skill commands at the ACP transport boundary", async () => {
    const agentPath = join(workspaceDir, "image-agent.mjs");
    const promptLog = join(workspaceDir, "prompt-blocks.jsonl");
    const imagePath = join(workspaceDir, "pixel.png");
    const imageData =
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6DioAAAAASUVORK5CYII=";
    writeFileSync(imagePath, Buffer.from(imageData, "base64"));
    writeFileSync(
      agentPath,
      readFileSync(FAKE_AGENT_PATH, "utf8")
        .replace(
          "promptCapabilities: { image: false }",
          "promptCapabilities: { image: true }",
        )
        .replace(
          "JSON.stringify(text)",
          "JSON.stringify(message.params.prompt)",
        ),
    );
    const { providerThreadId } = await startThread({
      agent: { command: process.execPath, args: [agentPath] },
      envVars: { FAKE_ACP_PROMPT_LOG: promptLog },
    });
    const commandName = "skill:inspect";
    const commandText = `/${commandName}`;
    const commandMention = {
      start: 0,
      end: commandText.length,
      resource: {
        kind: "command",
        trigger: "/",
        name: commandName,
        source: "skill",
        origin: "project",
        label: commandName,
        argumentHint: null,
      },
    };
    const scenarios = [
      { text: commandText, mentions: [commandMention] },
      { text: commandText, mentions: [] },
      { text: "Inspect the attached image", mentions: [] },
      { text: null, mentions: [] },
    ];
    for (const [index, scenario] of scenarios.entries()) {
      const completedBefore = threadEventsOfType("turn/completed").length;
      const response = await waitForResponse(
        sendTurnRequest("turn/start", providerThreadId, {
          input: [
            ...(scenario.text === null
              ? []
              : [
                  {
                    type: "text",
                    text: scenario.text,
                    mentions: scenario.mentions,
                  },
                ]),
            { type: "localImage", path: imagePath },
          ],
        }),
      );
      expect(response.error).toBeUndefined();
      await waitFor(
        () =>
          threadEventsOfType("turn/completed").length > completedBefore
            ? true
            : undefined,
        "image turn completion",
      );
      const prompts = readFileSync(promptLog, "utf8").trim().split("\n");
      expect(JSON.parse(prompts[index]!)).toEqual([
        ...(scenario.text === null
          ? []
          : [{ type: "text", text: scenario.text }]),
        { type: "image", data: imageData, mimeType: "image/png" },
      ]);
    }
    process.stderr.write(
      "ACP attachment probe: native skill with mention [text,image]; raw slash [text,image]; plain text [text,image]; image only [image]. All image bytes preserved.\n",
    );
  });

