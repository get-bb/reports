import assert from "node:assert/strict";
import { assembleThreadPullRequest } from "./apps/server/src/services/environments/pull-request.ts";
import { getPullRequestAttentionDisplay, getPullRequestGithubCheckStatus } from "./apps/app/src/lib/pull-request-display.ts";
import type { GitHostPullRequest } from "./packages/domain/src/index.ts";
const raw: GitHostPullRequest = {
  number: 1, title: "Status fixture", url: "https://github.com/get-bb/bb/pull/1",
  state: "OPEN", isDraft: false, baseRefName: "main", headRefName: "fixture",
  updatedAt: "2026-09-25T00:00:00Z", reviewDecision: "APPROVED",
  reviewRequestCount: 0, mergeStateStatus: "BLOCKED", mergeable: "MERGEABLE",
  checks: [{ name: "build", status: "in_progress", conclusion: null, url: null, startedAt: null }],
};
const cases = [
  { name: "approved-pending", raw, expected: "checks_pending" },
  { name: "review-outstanding", raw: { ...raw, checks: [], reviewDecision: "REVIEW_REQUIRED" as const, reviewRequestCount: 1 }, expected: "review_requested" },
  { name: "failed-control", raw: { ...raw, checks: [{ ...raw.checks[0], status: "completed" as const, conclusion: "failure" as const }] }, expected: "checks_failed" },
];
let failures = 0;
for (const entry of cases) {
  const pr = assembleThreadPullRequest(entry.raw);
  const display = getPullRequestAttentionDisplay(pr);
  console.log(JSON.stringify({ case: entry.name, checks: pr.checks.state, review: pr.review.state, attention: pr.attention, label: display.label, className: display.className, badge: getPullRequestGithubCheckStatus(pr) }));
  try { assert.equal(pr.attention, entry.expected); }
  catch { failures++; console.log(`FAIL ${entry.name}: expected ${entry.expected}, actual ${pr.attention}`); }
}
console.log(`${failures} regression assertions failed`);
process.exitCode = failures ? 1 : 0;
