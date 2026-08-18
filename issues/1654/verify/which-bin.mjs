import { query } from "/home/sawyer/projects/bb/.claude/worktrees/wf_242c3e11-a10-65/plugins/provider-claude-code/node_modules/@anthropic-ai/claude-agent-sdk/sdk.mjs";
import { execSync } from "node:child_process";
const prompt = { [Symbol.asyncIterator]() { return { next() { return new Promise(() => {}); } }; } };
const q = query({ prompt, options: { cwd: "/tmp", settingSources: [], persistSession: false, tools: [], allowedTools: [] } });
(async () => { for await (const m of q) {} })().catch(() => {});
setTimeout(() => {
  console.log(execSync(`ps -eo pid,ppid,args | awk '$2==${process.pid}'`).toString());
  q.close(); process.exit(0);
}, 3000);
