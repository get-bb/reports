#!/usr/bin/env node
// Minimal ACP agent (JSON-RPC over stdio) that mimics what omp (`omp acp`)
// sends: a `model` config-option select whose options carry
// { value: "provider/model", name: <display name>, description: "provider/model" }.
// Two options deliberately share the display name "GLM 4.7".
import { createInterface } from "node:readline";

const MODELS = [
  { value: "zai/glm-4.7", name: "GLM 4.7", description: "zai/glm-4.7" },
  {
    value: "openrouter/glm-4.7",
    name: "GLM 4.7",
    description: "openrouter/glm-4.7",
  },
  {
    value: "anthropic/claude-opus-5",
    name: "Claude Opus 5",
    description: "anthropic/claude-opus-5",
  },
];
let selectedModel = MODELS[0].value;
const sessionId = `fake-omp-${process.pid}`;

const send = (m) => process.stdout.write(JSON.stringify(m) + "\n");
const configState = () => ({
  configOptions: [
    {
      id: "model",
      name: "Model",
      category: "model",
      type: "select",
      currentValue: selectedModel,
      options: MODELS,
    },
  ],
});

createInterface({ input: process.stdin }).on("line", (line) => {
  if (!line.trim()) return;
  const msg = JSON.parse(line);
  switch (msg.method) {
    case "initialize":
      return send({
        jsonrpc: "2.0",
        id: msg.id,
        result: {
          protocolVersion: 1,
          agentCapabilities: {
            loadSession: false,
            promptCapabilities: { image: false },
          },
        },
      });
    case "session/new":
      return send({
        jsonrpc: "2.0",
        id: msg.id,
        result: { sessionId, ...configState() },
      });
    case "session/set_config_option":
      if (
        msg.params?.configId === "model" &&
        MODELS.some((m) => m.value === msg.params.value)
      ) {
        selectedModel = msg.params.value;
        return send({ jsonrpc: "2.0", id: msg.id, result: configState() });
      }
      return send({
        jsonrpc: "2.0",
        id: msg.id,
        error: {
          code: -32602,
          message: `unknown config ${msg.params?.configId}`,
        },
      });
    case "session/prompt":
      send({
        jsonrpc: "2.0",
        method: "session/update",
        params: {
          sessionId,
          update: {
            sessionUpdate: "agent_message_chunk",
            content: { type: "text", text: `ok (model=${selectedModel})` },
          },
        },
      });
      return send({
        jsonrpc: "2.0",
        id: msg.id,
        result: { stopReason: "end_turn" },
      });
    case "session/cancel":
      return;
    default:
      if (msg.id !== undefined) {
        send({
          jsonrpc: "2.0",
          id: msg.id,
          error: { code: -32601, message: `unsupported ${msg.method}` },
        });
      }
  }
});
