/**
 * Repro for get-bb/bb#1334 (control-plane view of the failure).
 *
 * A host daemon that is throttled by cgroup memory reclaim (or otherwise
 * frozen) keeps its TCP/WebSocket connection open — the kernel still ACKs —
 * but stops sending `heartbeat` messages, so `lease_expires_at` goes stale.
 *
 * Since #421 the server derives host liveness ONLY from the in-memory socket
 * registration in NotificationHub and never looks at the lease. As a result a
 * frozen daemon is reported "connected", its active threads stay `active`
 * with no reconnect deadline, and nothing ever fails or pauses the turn. The
 * UI therefore spins indefinitely with no actionable state.
 *
 * Every assertion below documents CURRENT behavior (they pass on main). The
 * `.fails` variants state what a resource-exhaustion-aware server should do.
 */
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import {
  createConnection,
  hostDaemonSessions,
  migrate,
  noopNotifier,
  openSession,
  upsertHost,
} from "@bb/db";
import { LEASE_TIMEOUT_MS } from "../../../src/constants.js";
import { listPublicHostsWithStatus } from "../../../src/services/lib/entity-lookup.js";
import { resolveThreadRuntimeState } from "../../../src/services/threads/thread-runtime-display.js";
import { NotificationHub } from "../../../src/ws/hub.js";

function setupFrozenDaemon(args: { frozenForMs: number }) {
  const db = createConnection(":memory:");
  migrate(db);
  const hub = new NotificationHub();
  const host = upsertHost(db, noopNotifier, {
    id: "host-frozen",
    name: "Frozen Host",
    type: "persistent",
  });
  const now = 10 * 60_000;
  const session = openSession(db, noopNotifier, {
    hostId: host.id,
    instanceId: `instance-${randomUUID()}`,
    hostName: "Frozen Host",
    hostType: "persistent",
    dataDir: "/tmp/host-frozen",
    protocolVersion: 1,
    heartbeatIntervalMs: 5_000,
    leaseTimeoutMs: LEASE_TIMEOUT_MS,
  });
  // The daemon last heart-beat `frozenForMs` ago; the lease is long expired.
  db.update(hostDaemonSessions)
    .set({ leaseExpiresAt: now - args.frozenForMs + LEASE_TIMEOUT_MS })
    .where(eq(hostDaemonSessions.id, session.id))
    .run();
  // ...but its socket is still registered: a throttled process does not
  // close its TCP connections.
  hub.registerDaemon(session.id, host.id, { close() {}, send() {} });
  return { db, hub, hostId: host.id, now, session };
}

describe("#1334 frozen (throttled) daemon is indistinguishable from a healthy one", () => {
  const frozenForMs = 5 * 60_000; // 5 minutes without a heartbeat (lease is 30s)

  it("reports the host as connected although no heartbeat arrived for 5 minutes", () => {
    const { db, hub, hostId } = setupFrozenDaemon({ frozenForMs });
    const host = listPublicHostsWithStatus({ db, hub }).find((h) => h.id === hostId);
    expect(host?.status).toBe("connected"); // current behavior
  });

  it("keeps the thread `active` with no reconnect/failure deadline", () => {
    const { db, hub, hostId, now } = setupFrozenDaemon({ frozenForMs });
    expect(
      resolveThreadRuntimeState(
        { db, hub },
        { environmentHostId: hostId, now, status: "active" },
      ),
    ).toEqual({ displayStatus: "active", hostReconnectGraceExpiresAt: null }); // spinner forever
  });

  it.fails("SHOULD surface a stale/unresponsive host state after the lease expires", () => {
    const { db, hub, hostId, now } = setupFrozenDaemon({ frozenForMs });
    const state = resolveThreadRuntimeState(
      { db, hub },
      { environmentHostId: hostId, now, status: "active" },
    );
    // Desired: some non-"active" display status (e.g. waiting-for-host /
    // host-unresponsive) or a deadline after which the turn is failed.
    expect(state.displayStatus).not.toBe("active");
  });
});
