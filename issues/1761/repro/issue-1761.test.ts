import { createFakePluginHost } from "@get-bb/plugin-sdk/testing";
import { describe, expect, it } from "vitest";
import plugin from "../server";

// Issue #1761: `bb tasks attach` is append-only (no inverse), and
// `bb tasks threads` lists attachments oldest-first, so after a respawn the
// first row is the dead predecessor. This test documents current behavior on
// main. The assertions marked "BUG" FAIL on 16ceb3a54 because the bug exists.

type ThreadStatus = "starting" | "active" | "idle" | "error";

function stdout(result: { exitCode: number; stdout: string; stderr: string }) {
  expect(result, result.stderr).toMatchObject({ exitCode: 0, stderr: "" });
  return result.stdout;
}

async function setup(statuses: Map<string, ThreadStatus>) {
  const { bb, harness } = createFakePluginHost({
    pluginId: "tasks",
    sdk: {
      threads: {
        // The plugin reads the thread's live status from the SDK at attach
        // time; the reconcile service does the same later.
        get: async ({ threadId }) => ({
          id: threadId,
          title: `title of ${threadId}`,
          titleFallback: null,
          status: statuses.get(threadId) ?? "idle",
        }),
        send: async () => undefined,
      },
    },
  });
  await plugin(bb);
  stdout(
    await harness.runCli(["project", "create", "--name", "Scani", "--prefix", "SC"]),
  );
  stdout(
    await harness.runCli(["create", "--project", "SC", "--title", "OSS audit"]),
  );
  return { bb, harness };
}

describe("issue #1761: task thread attachments", () => {
  it("BUG: `bb tasks threads` returns the dead (oldest) thread first after a respawn", async () => {
    const statuses = new Map<string, ThreadStatus>([
      ["thr_dead_predecessor", "error"],
      ["thr_live_worker", "idle"],
    ]);
    const { harness } = await setup(statuses);
    try {
      // Orchestrator attaches the first worker; it later dies (status error).
      stdout(await harness.runCli(["attach", "SC-1", "--thread", "thr_dead_predecessor"]));
      // Respawn: the orchestrator attaches the replacement.
      stdout(await harness.runCli(["attach", "SC-1", "--thread", "thr_live_worker"]));

      const listed = JSON.parse(
        stdout(await harness.runCli(["threads", "SC-1", "--json"])),
      ) as { taskThreads: Array<{ threadId: string; liveStatus: string }> };

      // Both attachments accumulate (append-only)...
      expect(listed.taskThreads.map((t) => t.threadId)).toEqual([
        "thr_dead_predecessor",
        "thr_live_worker",
      ]);
      expect(listed.taskThreads[0]?.liveStatus).toBe("failed");

      // ...and the human table puts the failed thread on the first row.
      const table = stdout(await harness.runCli(["threads", "SC-1"]));
      const firstRow = table.split("\n")[1] ?? "";
      expect(firstRow).toContain("thr_dead_predecessor");
      expect(firstRow).toContain("failed");

      // BUG (fails on main): a reader expects the live thread first, i.e.
      // most-recent-first or live-before-terminal ordering.
      expect(listed.taskThreads[0]?.threadId).toBe("thr_live_worker");
    } finally {
      await harness.dispose();
    }
  });

  it("BUG: there is no `detach` inverse for `attach`", async () => {
    const { harness } = await setup(new Map([["thr_x", "idle"]]));
    try {
      stdout(await harness.runCli(["attach", "SC-1", "--thread", "thr_x"]));

      const help = stdout(await harness.runCli(["--help"]));
      expect(help).toContain("attach ");
      // BUG (fails on main): help advertises no detach command...
      expect(help).toContain("detach");
    } finally {
      await harness.dispose();
    }
  });

  it("BUG: `bb tasks detach` is an unknown command", async () => {
    const { harness } = await setup(new Map([["thr_x", "idle"]]));
    try {
      stdout(await harness.runCli(["attach", "SC-1", "--thread", "thr_x"]));
      const result = await harness.runCli(["detach", "SC-1", "--thread", "thr_x"]);
      // Documents current behavior; the "BUG" expectation below fails on main.
      expect(result.stderr).toBe("unknown command: detach; run bb tasks --help");
      expect(result.exitCode).toBe(0);
    } finally {
      await harness.dispose();
    }
  });
});
