import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { writeFileSync } from "node:fs";
import { assembleThreadPullRequest } from "../server/src/services/environments/pull-request";
import { getPullRequestAttentionDisplay } from "./src/lib/pull-request-display";
import { PullRequestStatusPill } from "./src/components/pull-request/PullRequestStatusPill";
Object.assign(globalThis, { React });
const raw = { number: 1, title: "Status fixture", url: "https://github.com/get-bb/bb/pull/1", state: "OPEN" as const, isDraft: false, baseRefName: "main", headRefName: "fixture", updatedAt: "2026-09-25T00:00:00Z", reviewDecision: "APPROVED" as const, reviewRequestCount: 0, mergeStateStatus: "BLOCKED" as const, mergeable: "MERGEABLE" as const, checks: [{ name: "build", status: "in_progress" as const, conclusion: null, url: null, startedAt: null }] };
const entries = [
  { label: "Approved; checks running; branch protection blocks merge", raw },
  { label: "Review requested; branch protection blocks merge", raw: { ...raw, checks: [], reviewDecision: "REVIEW_REQUIRED" as const, reviewRequestCount: 1 } },
  { label: "Control: failing check", raw: { ...raw, checks: [{ ...raw.checks[0], status: "completed" as const, conclusion: "failure" as const }] } },
];
const body = renderToStaticMarkup(<main style={{ padding: 32, maxWidth: 850 }}><h1>Issue 4312: component fixture on trusted main</h1><p>Actual PullRequestStatusPill and display functions; synthetic inputs. This is not a live GitHub session.</p>{entries.map((entry) => { const pr = assembleThreadPullRequest(entry.raw); const display = getPullRequestAttentionDisplay(pr); return <section key={entry.label} style={{ marginTop: 30 }}><h2>{entry.label}</h2><div className="flex items-center gap-1.5 text-xs" style={{ marginTop: 12 }}><PullRequestStatusPill pullRequest={pr} /><span>PR #{pr.number}</span><span className={display.className}>· {display.label}</span></div><pre style={{ marginTop: 12 }}>{JSON.stringify({ checks: pr.checks.state, review: pr.review.state, attention: pr.attention })}</pre></section>; })}</main>);
writeFileSync("apps/app/dist/repro-4312.html", `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="/assets/index-C5-8cYca.css"><title>Issue 4312 fixture</title></head><body>${body}</body></html>`);
