import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { ThreadEventRow } from "@bb/domain";
import { describe, it } from "vitest";
import { renderTimelineFixture } from "./timeline-test-harness.js";

// Replays the real event log of the live repro thread (thr_3qxpfum5zs, claude-code,
// captured from GET /api/v1/threads/:id/events) through the timeline builder and
// prints the top-level rows. Used to compare main vs PR #1657 on real data.

describe("#1656 live event replay", () => {
  it("prints top-level rows for the completed live thread", () => {
    const path = fileURLToPath(
      new URL("./issue-1656-live-events.json", import.meta.url),
    );
    const events = JSON.parse(readFileSync(path, "utf8")) as ThreadEventRow[];
    const fixture = renderTimelineFixture({
      events,
      projectionOptions: { threadStatus: "idle", turnMessageDetail: "summary" },
    });
    const lines = fixture.rows.map((row) => {
      if (row.kind === "conversation") {
        return `${row.role}: ${row.text.replace(/\s+/g, " ").slice(0, 60)}`;
      }
      if (row.kind === "turn") return `turn-summary(count=${row.summaryCount})`;
      if (row.kind === "work") return `work(${row.workKind})`;
      return row.kind;
    });
    console.log("LIVE COMPLETED:\n  " + lines.join("\n  "));
    for (const entry of fixture.projection.entries) {
      if (entry.kind === "turn") {
        console.log(
          "LIVE turn messages: " +
            (entry.turn.messages ?? [])
              .map(
                (m) =>
                  `${m.kind}${m.kind === "user" ? `(initiator=${m.initiator})` : ""}`,
              )
              .join(", "),
        );
      } else {
        console.log("LIVE projected-message: " + entry.message.kind);
      }
    }
  });
});
