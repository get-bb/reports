// Drives the Claude Agent SDK directly (no bb) with the SAME sandbox settings the
// bb claude-code bridge uses (plugins/provider-claude-code/src/bridge/session-options.ts)
// and a canUseTool that logs every call. Shows whether `permissionMode: "auto"`
// lets a Bash write outside cwd through without any callback.
//
// usage: node sdk-probe.mjs <auto|acceptEdits> <cwd> <target-file>
import { query } from "@anthropic-ai/claude-agent-sdk";

const [mode, cwd, target] = process.argv.slice(2);
if (!mode || !cwd || !target) {
  console.error("usage: node sdk-probe.mjs <auto|acceptEdits> <cwd> <target-file>");
  process.exit(2);
}

const prompt = process.env.PROBE_TOOL === "write"
  ? `Use the Write tool (not Bash) to create the file ${target} containing exactly ESCAPED. Then reply with the single word DONE if it succeeded or BLOCKED if it failed. Do not try any other tool.`
  : `Run exactly this shell command with the Bash tool and nothing else: printf ESCAPED > ${target}. Then reply with the single word DONE if it succeeded or BLOCKED if it failed. Do not try any other tool.`;

const q = query({
  prompt,
  options: {
    cwd,
    permissionMode: mode,
    model: process.env.PROBE_MODEL ?? "claude-opus-5[1m]",
    maxTurns: 3,
    pathToClaudeCodeExecutable: process.env.CLAUDE_BIN,
    // bb mirrors the CLI cascade (sdk-session.ts); the SDK default loads none.
    settingSources: process.env.NO_SETTING_SOURCES ? [] : ["user", "project", "local"],
    sandbox: {
      enabled: true,
      failIfUnavailable: false,
      autoAllowBashIfSandboxed: true,
      allowUnsandboxedCommands: true,
      network: { allowLocalBinding: true },
    },
    stderr: (d) => { if (/sandbox|bwrap|socat/i.test(d)) console.log("[stderr]", d.trim().slice(0, 300)); },
    canUseTool: async (toolName, input, opts) => {
      console.log("[canUseTool]", toolName, JSON.stringify(input), JSON.stringify({ decisionReason: opts.decisionReason, blockedPath: opts.blockedPath, suggestions: opts.suggestions }));
      // Deny like bb would for an out-of-workspace escalation on an escalation-denied turn.
      return { behavior: "deny", message: "probe: denied by canUseTool", toolUseID: opts.toolUseID };
    },
  },
});

for await (const msg of q) {
  if (msg.type === "system" && msg.subtype === "init") {
    console.log("[init]", JSON.stringify({ permissionMode: msg.permissionMode, cwd: msg.cwd, model: msg.model, sandbox: msg.sandbox ?? null }));
  } else if (msg.type === "assistant") {
    for (const b of msg.message.content) {
      if (b.type === "tool_use") console.log("[tool_use]", JSON.stringify(b.input));
      if (b.type === "text") console.log("[text]", b.text);
    }
  } else if (msg.type === "user") {
    const c = msg.message.content;
    if (Array.isArray(c)) for (const b of c) if (b.type === "tool_result") console.log("[tool_result]", JSON.stringify(b.content).slice(0, 400));
  } else if (msg.type === "result") {
    console.log("[result]", msg.subtype, JSON.stringify(msg.permission_denials ?? null));
  }
}
