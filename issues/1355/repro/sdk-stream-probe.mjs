// Probe: what does the Claude Agent SDK stream emit when a Stop hook blocks?
// Run from plugins/provider-claude-code so the SDK resolves:
//   node /tmp/bb-reports/issues/1355/repro/sdk-stream-probe.mjs
import { query } from "@anthropic-ai/claude-agent-sdk";

const q = query({
  prompt: "Reply only with ok.",
  options: {
    cwd: "/tmp/bb-1355-repo",
    settingSources: ["project"],
    permissionMode: "acceptEdits",
    maxTurns: 4,
    model: "claude-sonnet-5", // any model you have access to; run with ANTHROPIC_MODEL unset
  },
});
for await (const m of q) {
  const summary = {
    type: m.type,
    subtype: m.subtype,
    isMeta: m.isMeta,
    isSynthetic: m.isSynthetic,
    content:
      m.message && typeof m.message.content === "string"
        ? m.message.content.slice(0, 120)
        : Array.isArray(m.message?.content)
          ? m.message.content.map((c) => c.type + (c.text ? ":" + c.text.slice(0, 60) : ""))
          : undefined,
  };
  console.log(JSON.stringify(summary));
}
