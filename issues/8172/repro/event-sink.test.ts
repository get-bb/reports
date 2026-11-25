import { turnScope } from "@bb/domain";
import { expect, it } from "vitest";
import { createEventSink } from "./event-sink.js";

it.each([1_000, 150_000])(
  "retains %i offline deltas through a transient failure",
  async (count) => {
    let open = false;
    let attempts = 0;
    let largestPost = 0;
    const delivered: string[] = [];
    const errors: string[] = [];
    const sink = createEventSink({
      isSessionOpen: () => open,
      logger: { debug() {}, error() {}, warn() {} },
      postEvents: async (envelopes) => {
        attempts += 1;
        largestPost = Math.max(largestPost, envelopes.length);
        if (attempts === 1) {
          throw new Error("injected transient transport failure");
        }
        for (const envelope of envelopes) {
          if (envelope.event.type === "item/agentMessage/delta") {
            delivered.push(`${envelope.threadId}:${envelope.event.delta}`);
          }
        }
        return { acceptedEvents: [], rejectedEvents: [] };
      },
    });
    const expected: string[] = [];
    try {
      for (let index = 0; index < count; index += 1) {
        const threadId = `thr_repro_${index % 3}`;
        expected.push(`${threadId}:${index}`);
        sink.emit({
          threadId,
          event: {
            type: "item/agentMessage/delta",
            threadId,
            providerThreadId: "provider-repro",
            scope: turnScope("turn-repro"),
            itemId: "item-repro",
            delta: String(index),
          },
        });
      }
      open = true;
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          await sink.flush();
        } catch (error) {
          if (!(error instanceof Error)) throw error;
          errors.push(`${error.name}: ${error.message}`);
        }
      }
      const remainingThreads = sink.listUndeliveredThreadIds();
      console.log(
        JSON.stringify({
          count,
          attempts,
          largestPost,
          delivered: delivered.length,
          remainingThreads,
          errors,
        }),
      );
      expect(errors).toEqual([]);
      expect(delivered).toEqual(expected);
      expect(remainingThreads).toEqual([]);
    } finally {
      await sink.dispose();
    }
  },
);
