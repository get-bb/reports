import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { Icon } from "../../../packages/shared-ui/src/components/ui/icon";
import { PullRequestBadge } from "../ui/PullRequestRowMetadata";
import { describePullRequestStatus } from "../ui/display";
import type { PullRequest } from "../contract";

Object.assign(globalThis, { React, __bbPluginRuntime: { react: React, pluginSdkApp: { experimental_Icon: Icon } } });
const base: PullRequest = {
  number: 73, title: "Update branch", url: "https://github.com/acme/example/pull/73",
  state: "open", baseRefName: "main", headRefName: "update", updatedAt: "2026-11-05T12:00:00Z",
  autoMerge: false, inMergeQueue: false,
  checks: { state: "passing", totalCount: 1, passedCount: 1, failedCount: 0, pendingCount: 0 },
  review: { state: "approved", reviewRequestCount: 0 },
  mergeability: { state: "mergeable", mergeStateStatus: "CLEAN", mergeable: "MERGEABLE" },
  attention: "ready_to_merge",
};
const examples: PullRequest[] = [
  { ...base, attention: "changes_requested", review: { state: "changes_requested", reviewRequestCount: 0 } },
  { ...base, number: 74, attention: "checks_failed", checks: { state: "failing", totalCount: 1, passedCount: 0, failedCount: 1, pendingCount: 0 } },
  { ...base, number: 75, attention: "checks_pending", checks: { state: "pending", totalCount: 1, passedCount: 0, failedCount: 0, pendingCount: 1 } },
  { ...base, number: 76 },
  { ...base, number: 77, state: "draft", attention: "draft" },
];
const markup = renderToStaticMarkup(<main style={{ padding: 48, maxWidth: 850, fontFamily: "system-ui" }}>
  <h1 style={{ fontSize: 24, marginBottom: 12 }}>PR badge rendering — issue 7118</h1>
  <p style={{ marginBottom: 32 }}>Actual component markup and app stylesheet; synthetic PR data.</p>
  {examples.map((pullRequest) => <div key={pullRequest.number} style={{ display: "flex", alignItems: "center", gap: 32, marginBottom: 28 }}>
    <div style={{ width: 70 }}><PullRequestBadge pullRequest={pullRequest} /></div>
    <span>{describePullRequestStatus(pullRequest)}</span>
  </div>)}
</main>);
const css = readFileSync(process.argv[2]!, "utf8");
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Issue 7118 rendered evidence</title><style>${css}</style></head><body>${markup}</body></html>`;
writeFileSync(process.argv[3]!, html);
writeFileSync(process.argv[4]!, `const page = await browser.getPage("main"); await page.goto("about:blank"); await page.evaluate(async (packed) => { const response = await fetch("data:application/gzip;base64," + packed); const html = await new Response(response.body.pipeThrough(new DecompressionStream("gzip"))).text(); document.open(); document.write(html); document.close(); }, ${JSON.stringify(gzipSync(html).toString("base64"))}); await page.snapshot();`);
