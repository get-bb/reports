import assert from "node:assert/strict";
import { randomInt } from "node:crypto";
import { createServer } from "node:http";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  experimental_createBridgeJsonRpcTestHarness,
  experimental_assembleCapturedThreadEvents,
} from "@get-bb/plugin-sdk/provider-bridge/testing";
import { handleLine } from "./src/bridge/bridge.ts";

const scratch = await mkdtemp(join(tmpdir(), "bb-5479-discovery-"));
const home = join(scratch, "home");
await mkdir(home);
const fullToolName = "mcp__bb-bridge__bb_schema_inspection";
const observations = [];
let generation = 1;
let sequence = 0;
const server = createServer(async (request, response) => {
  let payload = "";
  for await (const chunk of request) payload += chunk;
  if (!request.url.startsWith("/v1/messages")) {
    response.writeHead(200, { "content-type": "application/json" });
    response.end("{}");
    return;
  }
  const body = JSON.parse(payload);
  const main = Array.isArray(body.tools) &&
    body.tools.some((tool) => tool.name === "ToolSearch");
  const previousMain = observations.filter(
    (entry) => entry.generation === generation && entry.main,
  ).length;
  observations.push({ generation, main, body });
  const search = main && previousMain === 0;
  sequence += 1;
  const block = search
    ? {
        type: "tool_use",
        id: `toolu_inspect_${generation}_${sequence}`,
        name: "ToolSearch",
        input: { query: `select:${fullToolName}`, max_results: 1 },
      }
    : { type: "text", text: "Inspection finished." };
  const message = {
    id: `msg_inspect_${sequence}`,
    type: "message",
    role: "assistant",
    model: body.model,
    content: [block],
    stop_reason: search ? "tool_use" : "end_turn",
    stop_sequence: null,
    usage: { input_tokens: 30, output_tokens: 12 },
  };
  if (!body.stream) {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify(message));
    return;
  }
  response.writeHead(200, { "content-type": "text/event-stream" });
  const emit = (type, data) => response.write(
    `event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`,
  );
  emit("message_start", {
    message: { ...message, content: [], stop_reason: null },
  });
  emit("content_block_start", {
    index: 0,
    content_block: search
      ? { ...block, input: {} }
      : { type: "text", text: "" },
  });
  emit("content_block_delta", {
    index: 0,
    delta: search
      ? { type: "input_json_delta", partial_json: JSON.stringify(block.input) }
      : { type: "text_delta", text: block.text },
  });
  emit("content_block_stop", { index: 0 });
  emit("message_delta", {
    delta: { stop_reason: message.stop_reason, stop_sequence: null },
    usage: { output_tokens: 12 },
  });
  emit("message_stop", {});
  response.end();
});
const bridge = experimental_createBridgeJsonRpcTestHarness(handleLine);
const threadId = "schema-inspection-5479";
let providerThreadId;
let released = false;
let requestId = 100;
const waitFor = async (check) => {
  const deadline = Date.now() + 90000;
  while (!check()) {
    assert.ok(Date.now() < deadline, "Timed out waiting for bridge");
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
};
const rpc = async (method, params) => {
  requestId += 1;
  bridge.sendRequest(requestId, method, params);
  await waitFor(() => bridge.hasResponse(requestId));
  const reply = await bridge.waitForResponse(requestId);
  assert.equal(reply.error, undefined, JSON.stringify(reply.error));
  return reply.result;
};
const stop = async () => {
  await rpc("thread/stop", {
    threadId, providerThreadId, intent: "interrupt", activeTurnId: null,
  });
  released = true;
};
try {
  let port;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const candidate = randomInt(40000, 60001);
    try {
      await new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(candidate, "127.0.0.1", resolve);
      });
      port = candidate;
      break;
    } catch (error) {
      if (error.code !== "EADDRINUSE") throw error;
    }
  }
  assert.ok(port, "No free loopback port");
  const options = {
    permissionMode: "accept-edits",
    permissionScope: "workspace",
    approvalReviewer: "user",
    permissionEscalation: "deny",
    instructions: "Complete the inspection.",
    model: "claude-sonnet-4-5",
    envVars: {
      HOME: home,
      CLAUDE_CONFIG_DIR: join(home, "claude-config"),
      ANTHROPIC_BASE_URL: `http://127.0.0.1:${port}`,
      ANTHROPIC_API_KEY: "local-test-only",
      ENABLE_TOOL_SEARCH: "auto:0",
      CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1",
      DISABLE_TELEMETRY: "1",
      DISABLE_ERROR_REPORTING: "1",
    },
    providerOptions: {
      workflowsEnabled: false,
      memoryEnabled: false,
      providerSubagentsEnabled: false,
      sandboxEnabled: false,
    },
  };
  for (generation = 1; generation <= 2; generation += 1) {
    const tool = {
      name: "bb_schema_inspection",
      description: `Contract generation ${generation}`,
      inputSchema: {
        type: "object",
        properties: {
          count: { type: "number" },
          ...(generation === 2 ? { reason: { type: "string" } } : {}),
        },
        required: generation === 2 ? ["count", "reason"] : ["count"],
      },
    };
    const result = await rpc(generation === 1 ? "thread/start" : "thread/resume", {
      threadId,
      cwd: scratch,
      instructionMode: "append",
      options,
      dynamicTools: [tool],
      ...(generation === 2 ? { providerThreadId } : {}),
    });
    if (generation === 1) providerThreadId = result.providerThreadId;
    else assert.equal(result.providerThreadId, providerThreadId);
    released = false;
    const start = bridge.messages.length;
    await rpc("turn/start", {
      threadId,
      providerThreadId,
      clientRequestId: `creq_23456789a${generation + 1}`,
      input: [{ type: "text", text: "Inspect the available tool contract." }],
      options,
    });
    await waitFor(() => experimental_assembleCapturedThreadEvents(
      bridge.messages.slice(start), "claude-code",
    ).some((event) => event.type === "turn/completed"));
    const completed = experimental_assembleCapturedThreadEvents(
      bridge.messages.slice(start), "claude-code",
    ).find((event) => event.type === "turn/completed");
    assert.equal(completed.status, "completed", JSON.stringify(completed));
    await stop();
  }
  const mainRequests = observations.filter((entry) => entry.main).map((entry) => ({
    generation: entry.generation,
    tool: entry.body.tools.find((tool) => tool.name === fullToolName) ?? null,
    searchesInHistory: entry.body.messages.flatMap((message) =>
      Array.isArray(message.content) ? message.content : [],
    ).filter((block) => block.type === "tool_use" && block.name === "ToolSearch").length,
    searchResults: entry.body.messages.flatMap((message) =>
      Array.isArray(message.content) ? message.content : [],
    ).filter((block) => block.type === "tool_result" &&
      block.tool_use_id?.startsWith("toolu_inspect_")),
  }));
  const replacementCatalogueSeen = observations.some((entry) =>
    entry.generation === 2 && entry.body.tools?.some((tool) =>
      tool.name === fullToolName && tool.description === "Contract generation 2",
    ),
  );
  process.stderr.write(`${JSON.stringify({ port, replacementCatalogueSeen, mainRequests }, null, 2)}\n`);
  const latest = mainRequests.filter((entry) => entry.generation === 2).at(-1);
  assert.ok(latest?.tool, "Resumed model request must include discovered tool");
  assert.ok(latest.searchesInHistory >= 2, "Resume must preserve and repeat search");
  assert.ok(latest.searchResults.length >= 2, "Both searches must return results");
  assert.ok(latest.searchResults.every((result) => !result.is_error &&
    JSON.stringify(result.content).includes(fullToolName)), "Searches must succeed");
  assert.equal(latest.tool.description, "Contract generation 2");
  assert.ok(latest.tool.input_schema.required.includes("reason"));
} finally {
  if (providerThreadId && !released) await stop().catch(() => {});
  bridge.restore();
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  await rm(scratch, { recursive: true, force: true });
}
