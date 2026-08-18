// Minimal stdio MCP server exposing ONE tool. PROBE_SCHEMA selects the schema:
//   recursive  -> exactly what zod 4 `z.toJSONSchema(z.object({args: z.json()}))` emits
//                 (self-referential #/$defs/__schema0), i.e. bb's bb_workflow_run schema
//   flat       -> same field declared as a plain (non-recursive) schema
import { createInterface } from "node:readline";
import { appendFileSync } from "node:fs";

const RECURSIVE = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  type: "object",
  properties: {
    args: {
      default: null,
      description: "Optional input value",
      $ref: "#/$defs/__schema0",
    },
  },
  additionalProperties: false,
  $defs: {
    __schema0: {
      anyOf: [
        { type: "string" },
        { type: "number" },
        { type: "boolean" },
        { type: "null" },
        { type: "array", items: { $ref: "#/$defs/__schema0" } },
        {
          type: "object",
          propertyNames: { type: "string" },
          additionalProperties: { $ref: "#/$defs/__schema0" },
        },
      ],
    },
  },
};

const FLAT = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  type: "object",
  properties: {
    args: { description: "Optional input value" },
  },
  additionalProperties: false,
};

const inputSchema = process.env.PROBE_SCHEMA === "flat" ? FLAT : RECURSIVE;
// PROBE_SCHEMA=bb -> serve exactly what bb ships: the built-in
// update_environment_directory tool plus the two workflows-plugin tools
// (dumped from the plugin by dump-tool-schemas.test.ts).
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const HERE = dirname(fileURLToPath(import.meta.url));
const BB_TOOLS = process.env.PROBE_SCHEMA === "bb"
  ? [
      {
        name: "update_environment_directory",
        description: "Move this bb thread to a different working directory for subsequent turns. Use this when the user asks to switch to a new checkout, worktree, or local directory. The path must be an absolute existing directory on the current host.",
        inputSchema: { type: "object", properties: { path: { type: "string", description: "Absolute path to an existing directory on the current host." } }, required: ["path"], additionalProperties: false },
      },
      ...JSON.parse(readFileSync(join(HERE, "bb-workflow-tools.json"), "utf8")),
    ]
  : null;
const TOOLS = BB_TOOLS ?? [{ name: "probe_tool", description: "A probe tool. Never call it.", inputSchema }];
const write = (m) => process.stdout.write(JSON.stringify(m) + "\n");

createInterface({ input: process.stdin }).on("line", (line) => {
  if (!line.trim()) return;
  let msg;
  try { msg = JSON.parse(line); } catch { return; }
  appendFileSync("/tmp/bb-1612-scratch/stub-mcp.log", `${new Date().toISOString()} ${msg.method}\n`);
  if (msg.id === undefined || !msg.method) return;
  switch (msg.method) {
    case "initialize":
      write({ jsonrpc: "2.0", id: msg.id, result: {
        protocolVersion: msg.params?.protocolVersion ?? "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "probe", version: "1.0.0" },
      }});
      break;
    case "tools/list":
      write({ jsonrpc: "2.0", id: msg.id, result: { tools: TOOLS } });
      break;
    case "tools/call":
      write({ jsonrpc: "2.0", id: msg.id, result: { content: [{ type: "text", text: "ok" }] } });
      break;
    default:
      write({ jsonrpc: "2.0", id: msg.id, error: { code: -32601, message: "unsupported" } });
  }
});
