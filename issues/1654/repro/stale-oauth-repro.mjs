// Repro for get-bb/bb#1654: a long-lived Claude Code process (the way bb's
// provider-claude-code bridge keeps one `claude` process per thread) keeps
// using the OAuth access token it loaded at startup, even after
// ~/.claude/.credentials.json (here: $CLAUDE_CONFIG_DIR/.credentials.json) is
// rewritten by `claude login`.
//
// Run from plugins/provider-claude-code (needs @anthropic-ai/claude-agent-sdk):
//   node /tmp/bb-reports/issues/1654/repro/stale-oauth-repro.mjs
//
// Which `claude` binary runs: bb resolves the CLI on PATH (BB_CLAUDE_CODE_EXECUTABLE,
// then `claude` on PATH, then ~/.local/bin/claude, ...; see
// plugins/provider-claude-code/src/bridge/session-options.ts resolveClaudeCodeExecutable)
// and passes it to the SDK as pathToClaudeCodeExecutable. Without that option the
// Agent SDK spawns its OWN bundled CLI (@anthropic-ai/claude-agent-sdk-linux-x64,
// = Claude Code 2.1.197 for SDK 0.3.197), which is NOT what bb runs. This script
// therefore mirrors bb: REPRO_CLAUDE_BIN, else `claude` on PATH, else the SDK bundle
// (REPRO_CLAUDE_BIN=sdk-bundled forces the SDK bundle, for comparison).
import { query } from "@anthropic-ai/claude-agent-sdk";
import { createServer } from "node:http";
import { mkdtempSync, writeFileSync, statSync, realpathSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

function resolveClaudeBin() {
  if (process.env.REPRO_CLAUDE_BIN === "sdk-bundled") return null; // force the SDK's own CLI
  if (process.env.REPRO_CLAUDE_BIN) return realpathSync(process.env.REPRO_CLAUDE_BIN);
  try {
    return realpathSync(execFileSync("sh", ["-c", "command -v claude"], { encoding: "utf8" }).trim());
  } catch {
    return null; // fall back to the SDK-bundled CLI
  }
}
const claudeBin = resolveClaudeBin();
console.log(`[repro] claude binary: ${claudeBin ?? "(SDK-bundled @anthropic-ai/claude-agent-sdk-<platform> CLI)"}`);
if (claudeBin) console.log(`[repro] claude --version: ${execFileSync(claudeBin, ["--version"], { encoding: "utf8" }).trim()}`);

const TOKEN_A = "sk-ant-oat01-ACCOUNT-A-rate-limited";
const TOKEN_B = "sk-ant-oat01-ACCOUNT-B-fresh-login";

// ---- mock Anthropic API: token A is "rate limited", token B works ---------
const seen = [];
const server = createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    const auth = req.headers.authorization ?? "(none)";
    const token = auth.replace(/^Bearer /, "");
    seen.push({ path: req.url, token });
    console.log(`[mock-api] ${req.method} ${req.url} authorization=${auth}`);
    if (!req.url.startsWith("/v1/messages")) {
      res.writeHead(404).end();
      return;
    }
    if (token === TOKEN_A && process.env.REPRO_MODE !== "success-first") {
      res.writeHead(429, {
        "content-type": "application/json",
        "anthropic-ratelimit-unified-status": "rejected",
        "anthropic-ratelimit-unified-reset": String(Math.floor(Date.now() / 1000) + 3600),
      });
      res.end(JSON.stringify({ type: "error", error: { type: "rate_limit_error", message: "You have hit your usage limit (mock)" } }));
      return;
    }
    res.writeHead(200, { "content-type": "text/event-stream" });
    const ev = (t, d) => res.write(`event: ${t}\ndata: ${JSON.stringify({ type: t, ...d })}\n\n`);
    ev("message_start", { message: { id: "msg_1", type: "message", role: "assistant", model: "claude-sonnet-4-5", content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 1, output_tokens: 0 } } });
    ev("content_block_start", { index: 0, content_block: { type: "text", text: "" } });
    ev("content_block_delta", { index: 0, delta: { type: "text_delta", text: "ok" } });
    ev("content_block_stop", { index: 0 });
    ev("message_delta", { delta: { stop_reason: "end_turn", stop_sequence: null }, usage: { output_tokens: 1 } });
    ev("message_stop", {});
    res.end();
  });
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const baseUrl = `http://127.0.0.1:${server.address().port}`;

// ---- fake CLAUDE_CONFIG_DIR with OAuth credentials -----------------------
const configDir = mkdtempSync(join(tmpdir(), "bb1654-claude-config-"));
function writeCredentials(accessToken) {
  const credPath = join(configDir, ".credentials.json");
  let previous = null;
  try { previous = statSync(credPath, { bigint: true }); } catch {}
  writeFileSync(credPath, JSON.stringify({
    claudeAiOauth: {
      accessToken,
      refreshToken: "sk-ant-ort01-unused",
      expiresAt: Date.now() + 24 * 3600 * 1000,
      scopes: ["user:inference", "user:profile"],
      subscriptionType: "max",
    },
  }));
  if (previous && process.env.REPRO_MODE === "preserve-mtime") {
    // Emulate a credential store change that the CLI's mtime probe cannot see
    // (macOS: a leftover ~/.claude/.credentials.json next to a keychain entry).
    // node's utimes only has ms precision; use python os.utime(ns=...) to restore the exact nanosecond mtime
    execFileSync("python3", ["-c", "import os,sys;os.utime(sys.argv[1], ns=(int(sys.argv[2]), int(sys.argv[3])))", credPath, String(previous.atimeNs), String(previous.mtimeNs)]);
    const now = statSync(credPath, { bigint: true });
    console.log(`[repro] (preserve-mtime) mtimeNs before=${previous.mtimeNs} after=${now.mtimeNs} (${now.mtimeNs === previous.mtimeNs ? "unchanged" : "CHANGED"})`);
  }
  console.log(`[repro] wrote ${configDir}/.credentials.json with ${accessToken}`);
}
writeCredentials(TOKEN_A);

const env = {
  ...process.env,
  CLAUDE_CONFIG_DIR: configDir,
  ANTHROPIC_BASE_URL: baseUrl,
  CLAUDE_CODE_ENTRYPOINT: "cli",
  DISABLE_TELEMETRY: "1",
  CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1",
  NO_PROXY: "127.0.0.1,localhost",
};
for (const k of ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "CLAUDECODE", "CLAUDE_CODE_SESSION_ID", "CLAUDE_AGENT_SDK_CLIENT_APP", "CLAUDE_CODE_MESSAGING_SOCKET", "CLAUDE_CODE_MESSAGING_TOKEN", "CLAUDE_CODE_CHILD_SESSION", "CLAUDE_PID", "CLAUDE_CODE_EXECPATH", "ANTHROPIC_MODEL"]) delete env[k];

// ---- a streaming-input SDK session, exactly like bb's SdkSession.start() --
function openSession(label) {
  let resolveNext = null;
  const queue = [];
  const prompt = { [Symbol.asyncIterator]() { return { next() {
    if (queue.length) return Promise.resolve({ value: queue.shift(), done: false });
    return new Promise((r) => (resolveNext = r));
  } }; } };
  const q = query({ prompt, options: {
    cwd: process.cwd(), env, model: "claude-sonnet-4-5", ...(claudeBin ? { pathToClaudeCodeExecutable: claudeBin } : {}),
    systemPrompt: "Reply with ok.", permissionMode: "default",
    settingSources: [], persistSession: false, includePartialMessages: false,
    tools: [], allowedTools: [],
    stderr: (d) => process.stderr.write(`[claude stderr ${label}] ${d}`),
  } });
  const results = [];
  let onResult = null;
  (async () => { for await (const m of q) {
    if (m.type === "result") { results.push(m); onResult?.(m); }
  } })().catch((e) => console.log(`[${label}] stream error: ${e.message}`));
  return {
    turn(text) {
      const msg = { type: "user", message: { role: "user", content: text }, parent_tool_use_id: null, session_id: "" };
      const done = new Promise((r) => (onResult = r));
      if (resolveNext) { const r = resolveNext; resolveNext = null; r({ value: msg, done: false }); } else queue.push(msg);
      return done;
    },
    close() { q.close(); },
  };
}

function report(step, before) {
  const calls = seen.slice(before).filter((s) => s.path.startsWith("/v1/messages"));
  const tokens = [...new Set(calls.map((c) => c.token))];
  console.log(`[repro] ${step}: /v1/messages calls=${calls.length} tokens used=${JSON.stringify(tokens)}`);
  return tokens;
}

const summary = {};
console.log("\n=== Step 1: session P1 starts with token A (account A), first turn -> rate limited ===");
const p1 = openSession("P1");
let mark = seen.length;
let r = await p1.turn("Reply only with ok.");
console.log(`[repro] turn 1 result: subtype=${r.subtype} is_error=${r.is_error}`);
summary.turn1 = report("turn 1", mark);

console.log("\n=== Step 2: user runs `claude login` on account B (credentials file rewritten with token B) ===");
writeCredentials(TOKEN_B);

console.log("\n=== Step 3: retry on the SAME live process P1 (what bb does when you resend in the thread) ===");
mark = seen.length;
r = await p1.turn("Reply only with ok.");
console.log(`[repro] turn 2 result: subtype=${r.subtype} is_error=${r.is_error}`);
summary.turn2 = report("turn 2 (same process, after login)", mark);
p1.close();

console.log("\n=== Step 4: fresh process P2 (what a bb server restart gives you) ===");
const p2 = openSession("P2");
mark = seen.length;
r = await p2.turn("Reply only with ok.");
console.log(`[repro] turn 3 result: subtype=${r.subtype} is_error=${r.is_error}`);
summary.turn3 = report("turn 3 (new process)", mark);
p2.close();

server.close();
console.log("\n=== SUMMARY ===");
console.log(JSON.stringify(summary, null, 2));
const bug = summary.turn2.includes(TOKEN_A) && !summary.turn2.includes(TOKEN_B) && summary.turn3.includes(TOKEN_B);
console.log(bug
  ? "BUG REPRODUCED: the live claude process kept sending token A after the credentials file changed to token B; only a new process picked up token B."
  : "NOT reproduced: the live process picked up the new token.");
process.exit(bug ? 1 : 0);
