import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const checkout = resolve(process.argv[2] ?? ".");
const { forkClaudeSession } = await import(
  pathToFileURL(join(checkout, "plugins/provider-claude-code/src/bridge/session-fork.ts"))
);
const configDirectory = await mkdtemp(join(tmpdir(), "bb-7502-history-"));
try {
  const transcriptDirectory = join(configDirectory, "projects", "-tmp-synthetic");
  await mkdir(transcriptDirectory, { recursive: true });
  const sourceSessionId = randomUUID();
  const messageIds = Array.from({ length: 4 }, () => randomUUID());
  const callId = "synthetic-scheduler-call";
  const taskInput = {
    cron: "13 * * * *",
    prompt: "Synthetic diagnostic reminder",
    recurring: true,
  };
  const messages = [
    { type: "user", message: { role: "user", content: "Synthetic history fixture" } },
    {
      type: "assistant",
      message: {
        id: "synthetic-assistant-message",
        type: "message",
        role: "assistant",
        model: "synthetic-model",
        content: [{ type: "tool_use", id: callId, name: "CronCreate", input: taskInput }],
        stop_reason: "tool_use",
        stop_sequence: null,
        usage: { input_tokens: 1, output_tokens: 1 },
      },
    },
    {
      type: "user",
      message: {
        role: "user",
        content: [{ type: "tool_result", tool_use_id: callId, content: JSON.stringify({ id: "synthetic-task", ...taskInput }) }],
      },
    },
    { type: "assistant", message: { role: "assistant", content: [{ type: "text", text: "Synthetic fixture complete" }] } },
  ];
  const sourceEntries = messages.map((message, index) => ({
    ...message,
    uuid: messageIds[index],
    parentUuid: index === 0 ? null : messageIds[index - 1],
    sessionId: sourceSessionId,
    timestamp: new Date().toISOString(),
    isSidechain: false,
  }));
  const sourcePath = join(transcriptDirectory, `${sourceSessionId}.jsonl`);
  const sourceText = sourceEntries.map(entry => JSON.stringify(entry)).join("\n") + "\n";
  await writeFile(sourcePath, sourceText, { mode: 0o600 });
  const forkIds = new Set();
  for (const [mode, upToMessageId, expectedCalls] of [
    ["full", undefined, 1],
    ["after-result", messageIds[3], 1],
    ["before-task", messageIds[0], 0],
  ]) {
    const forkId = await forkClaudeSession({ configDirectory, sourceSessionId, upToMessageId });
    assert.notEqual(forkId, sourceSessionId);
    assert.ok(!forkIds.has(forkId));
    forkIds.add(forkId);
    const entries = (await readFile(join(transcriptDirectory, `${forkId}.jsonl`), "utf8"))
      .trim().split("\n").map(line => JSON.parse(line));
    const blocks = entries.flatMap(entry => Array.isArray(entry.message?.content) ? entry.message.content : []);
    const schedulerCalls = blocks.filter(block => block.type === "tool_use" && block.name === "CronCreate");
    const schedulerResults = blocks.filter(block => block.type === "tool_result" && block.tool_use_id === callId);
    assert.equal(schedulerCalls.length, expectedCalls);
    assert.equal(schedulerResults.length, expectedCalls);
    if (expectedCalls) assert.deepEqual(schedulerCalls[0].input, taskInput);
    assert.equal(await readFile(sourcePath, "utf8"), sourceText);
    console.log(`${mode}: distinct_session=true CronCreate_calls=${schedulerCalls.length} matching_results=${schedulerResults.length} source_unchanged=true`);
  }
  console.log("PASS: real bb fork worker and installed SDK copied scheduler tool history; no scheduler process was started.");
} finally {
  await rm(configDirectory, { recursive: true, force: true });
}
