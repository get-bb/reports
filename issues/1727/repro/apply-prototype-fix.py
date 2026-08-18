#!/usr/bin/env python3
"""Prototype of the proposed bridge-side fix for get-bb/bb#1727.

Applies to plugins/provider-codex/src/bridge/bridge.ts at 16ceb3a54: track
the Codex turn ids this session has started, and treat token/context usage for
any other turn as a replay (thread/resume, thread/fork). Context-window usage
is re-scoped to the thread (allowed by the scope policy); token usage (turn-only
by policy, and a duplicate of the persisted snapshot on resume) is dropped.
"""
import sys

p = sys.argv[1]
s = open(p).read()
old1 = '''  /** Codex-id space; open turns settle as failed if the child dies. */
  openCodexTurnIds: Set<string>;
  identityAnnounced: boolean;'''
new1 = '''  /** Codex-id space; open turns settle as failed if the child dies. */
  openCodexTurnIds: Set<string>;
  /**
   * Codex-id space; every turn this session has emitted turn/started for.
   * Thread-state snapshots for any other turn are replays (codex re-emits the
   * rollout's last-turn usage on thread/resume and thread/fork) and must not
   * be scoped to a bridge turn id bb has never seen (#1727).
   */
  startedCodexTurnIds: Set<string>;
  identityAnnounced: boolean;'''
assert old1 in s
s = s.replace(old1, new1)
old2 = '''  const out: ThreadEvent[] = [];

  if (event.type === "turn/started" && event.scope.kind === "turn") {
    session.openCodexTurnIds.add(event.scope.turnId);
  }'''
new2 = '''  const out: ThreadEvent[] = [];

  if (event.type === "turn/started" && event.scope.kind === "turn") {
    session.openCodexTurnIds.add(event.scope.turnId);
    session.startedCodexTurnIds.add(event.scope.turnId);
  }
  // Replayed thread-state snapshot (thread/resume, thread/fork): the turn it
  // names was never started in this session, so its bridge-minted turn id
  // would be unknown to bb. Context-window usage is session state and may be
  // thread-scoped; token usage is turn-only and, on resume, duplicates the
  // snapshot bb already persisted for that turn, so drop it.
  if (
    (event.type === "thread/tokenUsage/updated" ||
      event.type === "thread/contextWindowUsage/updated") &&
    event.scope.kind === "turn" &&
    !session.startedCodexTurnIds.has(event.scope.turnId)
  ) {
    if (event.type === "thread/contextWindowUsage/updated") {
      out.push(remapEvent(session, { ...event, scope: { kind: "thread" } }));
    }
    return out;
  }'''
assert old2 in s
s = s.replace(old2, new2)
old3 = '''    openCodexTurnIds: new Set(),
    identityAnnounced: false,'''
new3 = '''    openCodexTurnIds: new Set(),
    startedCodexTurnIds: new Set(),
    identityAnnounced: false,'''
assert old3 in s
s = s.replace(old3, new3)
open(p, "w").write(s)
print("patched", p)
