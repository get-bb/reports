import { expect, it } from "vitest";
import { createClaudeDeltaHarness } from "./delta-test-harness.js";

it.each([0, 2, 7])("settles the reasoning stream at index %i", (index) => {
  const harness = createClaudeDeltaHarness();
  const events = harness.translate({
    type: "stream_event",
    session_id: "repro-session",
    event: {
      type: "content_block_start",
      index,
      content_block: { type: "thinking", thinking: "Inspect the build." },
    },
  });
  events.push(...harness.translate({
    type: "assistant",
    session_id: "repro-session",
    message: {
      role: "assistant",
      content: [{ type: "thinking", thinking: "Inspect the build." }],
    },
  }));
  const opened = events.flatMap(event => event.type === "item/started" ? [event.item.id] : []);
  const closed = events.flatMap(event => event.type === "item/completed" ? [event.item.id] : []);
  expect(opened).toHaveLength(1);
  expect(closed).toEqual(opened);
});
