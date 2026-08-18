#!/usr/bin/env node
/**
 * Scripted stand-in for `codex app-server` used to reproduce get-bb/bb#1646.
 *
 * It speaks the subset of the app-server JSON-RPC dialect the bb codex bridge
 * drives (initialize, thread/start|resume, turn/start, turn/interrupt, ...)
 * and answers `turn/start` with a scenario picked from the FIRST WORD of the
 * prompt text (M1, M2, M3, PLAIN). Each scenario is a list of steps that are
 * either `{ "sleepMs": N }` or a notification `{ "method", "params" }`.
 * In params, `"$self"` is replaced by the codex thread id minted for the bb
 * session and `"$other"` by a second, foreign codex thread id (what a second
 * codex thread multiplexed on the same app-server connection looks like).
 *
 * Unlike the repo's test fake, `turn/start` is answered immediately and the
 * scripted notifications stream afterwards on their own timeline, exactly like
 * a real app-server.
 */
import { createInterface } from "node:readline";
import { appendFileSync } from "node:fs";

const LOG = process.env.FAKE_CODEX_LOG ?? "/tmp/1646-fake-codex.log";
function log(line) {
  try { appendFileSync(LOG, `${new Date().toISOString()} ${line}\n`); } catch {}
}

let threadCounter = 0;
const openTurns = new Map(); // turnId -> threadId

function send(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
  log(`>> ${JSON.stringify(message).slice(0, 300)}`);
}
function notify(method, params) { send({ jsonrpc: "2.0", method, params }); }
function respond(id, result) { send({ jsonrpc: "2.0", id, result }); }
function respondError(id, code, message) { send({ jsonrpc: "2.0", id, error: { code, message } }); }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function firstInputText(input) {
  const first = Array.isArray(input) ? input[0] : undefined;
  return first && first.type === "text" ? first.text : "";
}

const cmd = (id, turnId, command, status, extra = {}) => ({
  method: status === "inProgress" ? "item/started" : "item/completed",
  params: {
    threadId: "$self",
    turnId,
    item: {
      type: "commandExecution",
      id,
      command,
      cwd: "/tmp",
      status,
      ...extra,
    },
  },
});
const msg = (id, turnId, text, threadId = "$self") => [
  { method: "item/started", params: { threadId, turnId, item: { type: "agentMessage", id, text: "" } } },
  { method: "item/agentMessage/delta", params: { threadId, turnId, itemId: id, delta: text } },
  { method: "item/completed", params: { threadId, turnId, item: { type: "agentMessage", id, text } } },
];
const started = (turnId, threadId = "$self") => ({ method: "turn/started", params: { threadId, turn: { id: turnId, status: "inProgress" } } });
const completed = (turnId, threadId = "$self", status = "completed") => ({ method: "turn/completed", params: { threadId, turn: { id: turnId, status } } });

// A ~90 s tail of visible root work on turn X after bb has been told X is done.
function lateWork(turnId, prefix) {
  const steps = [];
  for (let i = 1; i <= 5; i += 1) {
    steps.push(cmd(`${prefix}-cmd-${i}`, turnId, `echo late-work-${i} && sleep 15`, "inProgress"));
    steps.push({ sleepMs: 15_000 });
    steps.push(cmd(`${prefix}-cmd-${i}`, turnId, `echo late-work-${i} && sleep 15`, "completed", { exitCode: 0, aggregatedOutput: `late-work-${i}\n` }));
    steps.push(...msg(`${prefix}-msg-${i}`, turnId, `still working after bb was told the turn ended (${i}/5)`));
    steps.push({ sleepMs: 3_000 });
  }
  return steps;
}

const SCENARIOS = {
  // Codex completes turn X, then keeps streaming root work on X and completes X again
  // (the shape PR #1697 assumes).
  M1: (n) => [
    started(`turn-X-${n}`),
    ...msg(`x-msg-0-${n}`, `turn-X-${n}`, "M1: starting; I will report turn X complete then keep working on X"),
    completed(`turn-X-${n}`),
    { sleepMs: 5_000 },
    ...lateWork(`turn-X-${n}`, `x-${n}`),
    completed(`turn-X-${n}`),
  ],
  // A second root turn Y (from another codex thread on the same app-server connection)
  // starts and completes while X is still open. Its completion flips bb idle; X keeps working.
  M2: (n) => [
    started(`turn-X-${n}`),
    ...msg(`x-msg-0-${n}`, `turn-X-${n}`, "M2: starting turn X"),
    { sleepMs: 3_000 },
    started(`turn-Y-${n}`, "$other"),
    ...msg(`y-msg-0-${n}`, `turn-Y-${n}`, "M2: phantom turn Y on another codex thread", "$other"),
    { sleepMs: 3_000 },
    completed(`turn-Y-${n}`, "$other"),
    { sleepMs: 5_000 },
    ...lateWork(`turn-X-${n}`, `x-${n}`),
    completed(`turn-X-${n}`),
  ],
  // Same as M1 but codex re-announces turn/started for X before resuming (does bb reactivate?).
  M3: (n) => [
    started(`turn-X-${n}`),
    ...msg(`x-msg-0-${n}`, `turn-X-${n}`, "M3: starting; complete X, then re-announce turn/started for X"),
    completed(`turn-X-${n}`),
    { sleepMs: 5_000 },
    started(`turn-X-${n}`),
    ...lateWork(`turn-X-${n}`, `x-${n}`),
    completed(`turn-X-${n}`),
  ],
  PLAIN: (n) => [
    started(`turn-P-${n}`),
    ...msg(`p-msg-${n}`, `turn-P-${n}`, "ok"),
    completed(`turn-P-${n}`),
  ],
};

function substitute(value, ids) {
  if (Array.isArray(value)) return value.map((v) => substitute(v, ids));
  if (value === null || typeof value !== "object") {
    return value === "$self" ? ids.self : value === "$other" ? ids.other : value;
  }
  const out = {};
  for (const [k, v] of Object.entries(value)) out[k] = substitute(v, ids);
  return out;
}

let turnCounter = 0;
async function runScenario(name, ids) {
  turnCounter += 1;
  const steps = (SCENARIOS[name] ?? SCENARIOS.PLAIN)(turnCounter);
  log(`-- scenario ${name} (#${turnCounter}) on ${ids.self} / other ${ids.other}`);
  for (const step of steps) {
    if (step.sleepMs) { await sleep(step.sleepMs); continue; }
    const params = substitute(step.params, ids);
    if (step.method === "turn/started") openTurns.set(params.turn.id, params.threadId);
    if (step.method === "turn/completed") openTurns.delete(params.turn.id);
    notify(step.method, params);
  }
}

const idsByThreadId = new Map();

async function handleRequest(message) {
  const { id, method } = message;
  const params = message.params ?? {};
  log(`<< ${method} ${JSON.stringify(params).slice(0, 200)}`);
  switch (method) {
    case "initialize": respond(id, {}); return;
    case "account/rateLimits/read": respond(id, { rateLimits: {} }); return;
    case "skills/extraRoots/set": respond(id, {}); return;
    case "thread/start": {
      threadCounter += 1;
      const self = `codex-fake-${process.pid}-${threadCounter}`;
      idsByThreadId.set(self, { self, other: `${self}-other` });
      notify("thread/started", { thread: { id: self } });
      respond(id, { thread: { id: self } });
      return;
    }
    case "thread/resume": {
      const self = String(params.threadId);
      idsByThreadId.set(self, { self, other: `${self}-other` });
      respond(id, { thread: { id: self } });
      return;
    }
    case "turn/start": {
      const ids = idsByThreadId.get(String(params.threadId)) ?? { self: String(params.threadId), other: `${params.threadId}-other` };
      const scenario = firstInputText(params.input).trim().split(/[\s:]+/)[0].toUpperCase();
      respond(id, {});
      void runScenario(scenario, ids);
      return;
    }
    case "turn/steer": respond(id, {}); return;
    case "turn/interrupt": {
      for (const [turnId, threadId] of [...openTurns]) {
        if (threadId === params.threadId) {
          openTurns.delete(turnId);
          notify("turn/completed", { threadId, turn: { id: turnId, status: "interrupted" } });
        }
      }
      respond(id, {});
      return;
    }
    case "thread/compact/start":
    case "thread/archive":
    case "thread/unarchive":
    case "thread/name/set":
    case "thread/goal/clear":
    case "thread/unsubscribe":
      respond(id, {}); return;
    default:
      respondError(id, -32601, `Unknown method "${method}"`);
  }
}

const lines = createInterface({ input: process.stdin, terminal: false });
lines.on("line", (line) => {
  const t = line.trim();
  if (!t) return;
  let parsed;
  try { parsed = JSON.parse(t); } catch { return; }
  if (parsed && parsed.id !== undefined && typeof parsed.method === "string") void handleRequest(parsed);
});
lines.on("close", () => process.exit(0));
