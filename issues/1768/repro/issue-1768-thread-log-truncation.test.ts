import { encodeClientTurnRequestIdNumber, threadScope, turnScope } from "@bb/domain";
import { threadTimelineResponseSchema } from "@bb/server-contract";
import { z } from "zod";
import { formatThreadTimelineText } from "@bb/thread-view";
import { describe, expect, it } from "vitest";
import { readJson } from "../helpers/json.js";
import { seedEvent, seedThreadFixture } from "../helpers/seed.js";
import { withTestHarness } from "../helpers/test-app.js";

// Issue #1768 (claim 2): `bb thread log <id>` (human formats) reads
// GET /threads/:id/timeline with the default page (latest 20 user-message
// segments) and prints the rows without any "older rows exist" marker.
// `bb thread log --json` reads GET /threads/:id/events with limit=100.
// This test seeds an orchestrator-like thread whose FIRST turn is a
// "[bb system] Child thread updates:" notification followed by 24 ordinary
// turns, and shows that both default views silently drop that notification.
describe("issue 1768: bb thread log silently truncates", () => {
  it("default timeline page drops the oldest [bb system] notification without any marker in the text output", async () => {
    await withTestHarness(async (harness) => {
      const { environment, thread } = seedThreadFixture(harness);

      const seedMessageTurn = (args: {
        requestId: number;
        startSequence: number;
        text: string;
        turnId: string;
        initiator: "user" | "system";
      }) => {
        seedEvent(harness.deps, {
          threadId: thread.id,
          environmentId: environment.id,
          sequence: args.startSequence,
          type: "client/turn/requested",
          scope: threadScope(),
          data: {
            direction: "outbound",
            requestId: encodeClientTurnRequestIdNumber({ value: args.requestId }),
            input: [{ type: "text", text: args.text }],
            target: { kind: "new-turn" },
            execution: {
              model: "gpt-5",
              reasoningLevel: "medium",
              permissionMode: "full",
              serviceTier: "default",
              source: "client/turn/requested",
            },
            initiator: args.initiator,
            senderThreadId: null,
            request: { method: "turn/start", params: {} },
            source: "tell",
          },
        });
        seedEvent(harness.deps, {
          threadId: thread.id,
          environmentId: environment.id,
          providerThreadId: "provider-thread-1",
          scope: turnScope(args.turnId),
          sequence: args.startSequence + 1,
          type: "turn/started",
          data: {},
        });
        seedEvent(harness.deps, {
          threadId: thread.id,
          environmentId: environment.id,
          providerThreadId: "provider-thread-1",
          scope: turnScope(args.turnId),
          sequence: args.startSequence + 2,
          type: "item/completed",
          data: {
            item: {
              type: "agentMessage",
              id: `${args.turnId}-assistant`,
              text: `${args.turnId} answered.`,
            },
          },
        });
        seedEvent(harness.deps, {
          threadId: thread.id,
          environmentId: environment.id,
          providerThreadId: "provider-thread-1",
          scope: turnScope(args.turnId),
          sequence: args.startSequence + 3,
          type: "turn/completed",
          data: { status: "completed" },
        });
      };

      const notification =
        "[bb system]\n\nChild thread updates:\n\n- @thread:thr_worker1 failed.\n- @thread:thr_worker2 completed.";
      // Turn 1 is the child-thread notification the orchestrator wants to find later.
      seedMessageTurn({
        requestId: 1,
        startSequence: 1,
        text: notification,
        turnId: "turn-1",
        initiator: "system",
      });
      // 24 more ordinary turns => 25 user-message segments, 100 events total.
      for (let i = 2; i <= 25; i += 1) {
        seedMessageTurn({
          requestId: i,
          startSequence: (i - 1) * 4 + 1,
          text: `Ordinary prompt ${i}`,
          turnId: `turn-${i}`,
          initiator: "user",
        });
      }

      // What `bb thread log <id>` (minimal format) requests: the default page.
      const timelineResponse = await harness.app.request(
        `/api/v1/threads/${thread.id}/timeline`,
      );
      expect(timelineResponse.status).toBe(200);
      const timeline = threadTimelineResponseSchema.parse(
        await readJson(timelineResponse),
      );
      // The server knows the page is truncated...
      expect(timeline.timelinePage.segmentLimit).toBe(20);
      expect(timeline.timelinePage.returnedSegmentCount).toBe(20);
      expect(timeline.timelinePage.hasOlderRows).toBe(true);

      // ...but the text the CLI prints carries no trace of that.
      const text = formatThreadTimelineText(timeline.rows, {
        verbose: false,
        color: false,
      });
      expect(text).toContain("Ordinary prompt 25");
      expect(text).toContain("Ordinary prompt 6");
      expect(text).not.toContain("Ordinary prompt 5");
      // The notification (turn 1) is outside the window and simply absent.
      expect(text).not.toContain("Child thread updates");
      // No hint of truncation anywhere in the human output.
      expect(text.toLowerCase()).not.toMatch(/older|truncat|more events|showing/);

      // `bb thread log --json` requests /events with limit=100 (the CLI default).
      const eventsResponse = await harness.app.request(
        `/api/v1/threads/${thread.id}/events?limit=100`,
      );
      expect(eventsResponse.status).toBe(200);
      const eventRowSchema = z.object({ seq: z.number(), type: z.string(), data: z.unknown() });
      const events = z.array(eventRowSchema).parse(await readJson(eventsResponse));
      // 100 events exactly fit; add one more turn and the NEWEST events fall
      // off: /events lists ascending by sequence and applies LIMIT, so the
      // JSON default is the OLDEST 100 events, not the last 100 the issue
      // assumes.
      expect(events).toHaveLength(100);
      seedMessageTurn({
        requestId: 26,
        startSequence: 101,
        text: "Ordinary prompt 26",
        turnId: "turn-26",
        initiator: "user",
      });
      const eventsResponse2 = await harness.app.request(
        `/api/v1/threads/${thread.id}/events?limit=100`,
      );
      const events2 = z.array(eventRowSchema).parse(await readJson(eventsResponse2));
      expect(events2).toHaveLength(100);
      const seqs = events2.map((event) => event.seq);
      expect(Math.min(...seqs)).toBe(1);
      expect(Math.max(...seqs)).toBe(100); // seq 101-104 (newest turn) dropped silently
      expect(
        events2.some(
          (event) =>
            event.type === "client/turn/requested" &&
            JSON.stringify(event.data).includes("Ordinary prompt 26"),
        ),
      ).toBe(false);
    });
  });

  // Desired behavior (FAILS on main): a windowed default page must say so.
  // Kept separate so the characterization test above stays green.
  it("EXPECTED TO FAIL ON MAIN: the human text should announce that older rows were omitted", async () => {
    await withTestHarness(async (harness) => {
      const { environment, thread } = seedThreadFixture(harness);
      for (let i = 1; i <= 25; i += 1) {
        seedEvent(harness.deps, {
          threadId: thread.id,
          environmentId: environment.id,
          sequence: i,
          type: "client/turn/requested",
          scope: threadScope(),
          data: {
            direction: "outbound",
            requestId: encodeClientTurnRequestIdNumber({ value: i }),
            input: [{ type: "text", text: `Prompt ${i}` }],
            target: { kind: "new-turn" },
            execution: {
              model: "gpt-5",
              reasoningLevel: "medium",
              permissionMode: "full",
              serviceTier: "default",
              source: "client/turn/requested",
            },
            initiator: "user",
            senderThreadId: null,
            request: { method: "turn/start", params: {} },
            source: "tell",
          },
        });
      }
      const timeline = threadTimelineResponseSchema.parse(
        await readJson(
          await harness.app.request(`/api/v1/threads/${thread.id}/timeline`),
        ),
      );
      expect(timeline.timelinePage.hasOlderRows).toBe(true);
      const text = formatThreadTimelineText(timeline.rows, {
        verbose: false,
        color: false,
      });
      // This is what a reader needs and what the CLI does not print today.
      expect(text.toLowerCase()).toMatch(/older|omitted|truncat/);
    });
  });
});
