// Standalone repro of the Claude Agent SDK behaviour behind bb issue #1718.
// No bb involved: this drives the SDK exactly like plugins/provider-claude-code
// (streaming input, persistSession, resume by session id) and prints every
// SDKMessage of the *resumed* session.
//
// Usage (from a bb worktree so the SDK resolves):
//   cd plugins/provider-claude-code && cp /tmp/bb-reports/issues/1718/repro/1718-sdk-resume.mjs . && node ./1718-sdk-resume.mjs
// Control (no background task, expect ONE result in phase 2): REPRO_NO_BG=1 node ./1718-sdk-resume.mjs
// Push the prompt N ms after resume instead of immediately: REPRO_PUSH_DELAY_MS=8000
//
// Phase 1: ask Claude to background `sleep 120` and reply "started"; wait for
//          the result; close the session (input stream ends, process exits)
//          exactly like bb's SdkSession.closeGracefully().
// Phase 2: resume the same session id and push ONE user prompt
//          ("reply with exactly: second"). Watch the message stream: the CLI
//          first synthesises a <task-notification status=stopped> for the
//          orphaned background task and emits a `result` (0 tokens) BEFORE it
//          answers the prompt.
import { query } from "@anthropic-ai/claude-agent-sdk";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const cwd = process.env.REPRO_CWD ?? mkdtempSync(join(tmpdir(), "1718-sdk-"));
const model = process.env.REPRO_MODEL ?? "claude-sonnet-4-5";

function makeInput() {
  const queue = [];
  let resolveNext = null;
  let done = false;
  const iterable = {
    [Symbol.asyncIterator]() {
      return {
        async next() {
          if (queue.length > 0) return { value: queue.shift(), done: false };
          if (done) return { value: undefined, done: true };
          return new Promise((r) => (resolveNext = r));
        },
      };
    },
  };
  return {
    iterable,
    push(text, sessionId = "") {
      const message = {
        type: "user",
        message: { role: "user", content: text },
        parent_tool_use_id: null,
        session_id: sessionId,
      };
      if (resolveNext) {
        const r = resolveNext;
        resolveNext = null;
        r({ value: message, done: false });
      } else queue.push(message);
    },
    end() {
      done = true;
      if (resolveNext) {
        const r = resolveNext;
        resolveNext = null;
        r({ value: undefined, done: true });
      }
    },
  };
}

function summarize(m) {
  const t = new Date().toISOString().slice(11, 23);
  if (m.type === "assistant") {
    const c = m.message?.content ?? [];
    return `${t} assistant ${JSON.stringify(c.map((b) => (b.type === "text" ? { text: b.text } : { tool_use: b.name })))}`;
  }
  if (m.type === "user") {
    const c = m.message?.content;
    const text = typeof c === "string" ? c : JSON.stringify(c);
    return `${t} user(${m.isSynthetic ? "synthetic" : "echo"}) ${text.slice(0, 220).replace(/\n/g, "\\n")}`;
  }
  if (m.type === "result") {
    return `${t} RESULT subtype=${m.subtype} num_turns=${m.num_turns} usage=${JSON.stringify(m.usage)} result=${JSON.stringify(m.result)?.slice(0, 120)}`;
  }
  if (m.type === "system") return `${t} system/${m.subtype}${m.subtype === "task_started" || m.subtype === "task_notification" ? " " + JSON.stringify(m).slice(0, 200) : ""}`;
  if (m.type === "stream_event") return null;
  return `${t} ${m.type}${m.subtype ? "/" + m.subtype : ""}`;
}

async function phase1() {
  const input = makeInput();
  let sessionId;
  const q = query({
    prompt: input.iterable,
    options: {
      cwd,
      model,
      permissionMode: "acceptEdits",
      includePartialMessages: true,
      persistSession: true,
      settingSources: ["user", "project", "local"],
      systemPrompt: { type: "preset", preset: "claude_code" },
    },
  });
  input.push(
    process.env.REPRO_NO_BG
      ? "Reply with exactly the word: started. Do not use any tools."
      : "Use the Bash tool with run_in_background set to true to run the command: sleep 120; echo BG_DONE. Once it is started in the background, reply with exactly the word: started. Do not wait for it and do not do anything else.",
  );
  for await (const m of q) {
    if (m.session_id) sessionId = m.session_id;
    const s = summarize(m);
    if (s) console.log("[phase1]", s);
    if (m.type === "result") {
      // bb's `thread/stop` on an idle thread == closeGracefully(): end the
      // input stream and wait (max 4s) for the CLI to exit; the CLI keeps
      // running while the background task is alive, so bb then aborts it.
      input.end();
      setTimeout(() => q.close(), 4000);
    }
  }
  return sessionId;
}

async function phase2(sessionId) {
  const input = makeInput();
  const q = query({
    prompt: input.iterable,
    options: {
      cwd,
      model,
      permissionMode: "acceptEdits",
      includePartialMessages: true,
      persistSession: true,
      settingSources: ["user", "project", "local"],
      systemPrompt: { type: "preset", preset: "claude_code" },
      resume: sessionId,
    },
  });
  const pushDelay = Number(process.env.REPRO_PUSH_DELAY_MS ?? 0);
  setTimeout(() => {
    console.log("[phase2] pushing SECOND_MSG");
    input.push("SECOND_MSG: reply with exactly the word: second", sessionId);
  }, pushDelay);
  let results = 0;
  for await (const m of q) {
    const s = summarize(m);
    if (s) console.log("[phase2]", s);
    if (m.type === "result") {
      results += 1;
      // Two results are expected when the bug shows: one empty (0 usage) for
      // the synthesized task-notification, one for the real answer.
      if (results >= 2 || (m.usage?.output_tokens ?? 0) > 0) {
        input.end();
        setTimeout(() => q.close(), 1500);
      }
    }
  }
  console.log(`[phase2] total result messages: ${results}`);
}

console.log("cwd:", cwd, "model:", model);
const sessionId = await phase1();
console.log("[phase1] session:", sessionId, "-> resuming in 3s");
await new Promise((r) => setTimeout(r, 3000));
await phase2(sessionId);
