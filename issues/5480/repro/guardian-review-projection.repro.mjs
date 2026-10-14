import { readFileSync } from "node:fs";
import { threadEventSchema } from "@bb/domain";
import { buildThreadTimelineFromEvents } from "@bb/thread-view";

const events = JSON.parse(readFileSync(process.argv[2], "utf8")).map((event, index) => ({
  event: threadEventSchema.parse(event),
  meta: { id: `review-${index}`, seq: index + 1, createdAt: 1791964800000 + index },
}));
const { rows } = buildThreadTimelineFromEvents({
  events,
  contextWindowEvents: events,
  acceptedClientRequestContext: {
    acceptedClientRequestEvents: [],
    rejectedClientRequestEvents: [],
  },
  options: {
    completedTurnDisplay: "collapse",
    includeDiagnosticOperations: true,
    includeNestedRows: true,
    isLatestPage: true,
    providerId: "codex",
    providerDisplayName: "Codex",
    threadStatus: "idle",
    threadName: "Synthetic review reproduction",
    workspaceRoot: null,
  },
});
console.log(JSON.stringify(rows, null, 2));
if (rows.length !== 2 || rows.some((row) => row.operationKind !== "provider-unhandled")) {
  throw new Error("The diagnostic-row reproduction did not match.");
}
