import { createInterface } from "node:readline";
import { appendFileSync } from "node:fs";

const models = ["probe-a", "probe-b", "probe-c"];
const configOptions = [
  { id: "model", category: "model", type: "select", currentValue: models[0],
    options: models.map(value => ({ value, name: value })) },
  { id: "effort", category: "thought_level", type: "select", currentValue: "low",
    options: ["low", "medium", "high"].map(value => ({ value })) },
];
createInterface({ input: process.stdin }).on("line", line => {
  const request = JSON.parse(line);
  let result;
  if (request.method === "initialize") {
    result = { protocolVersion: 1, agentCapabilities: {}, authMethods: [] };
  } else if (request.method === "session/new") {
    result = { sessionId: "repro-session", configOptions };
  } else if (request.method === "session/set_config_option") {
    appendFileSync(process.env.REPRO_REQUEST_LOG, request.params.value + "\n");
    if (process.env.REPRO_REJECT_MIDDLE === "1" && request.params.value === models[1]) {
      process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id: request.id,
        error: { code: -32603, message: "synthetic model rejection" } }) + "\n");
      return;
    }
    result = { configOptions };
  } else {
    return;
  }
  process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id: request.id, result }) + "\n");
});
