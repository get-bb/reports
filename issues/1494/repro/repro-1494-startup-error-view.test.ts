// Repro for get-bb/bb#1494 (unit half).
//
// The desktop startup error screen is a static `data:` URL rendered by
// `createLocalViewUrl`. This test shows what the live repro shows visually:
// the view that `runDesktopApp().catch(...)` (apps/desktop/src/main.ts) falls
// back to when a saved remote target is unreachable carries the raw Electron
// stack as its body, offers no control the user could click, and locks itself
// down with `default-src 'none'` so it cannot ever run a Retry / Use This Mac
// handler. Together with the unguarded `loadWindowUrl` in `applyServerTarget`
// this is the "dead end" from the issue.
//
// The assertions marked EXPECTED (desired behaviour) FAIL on main; the ones
// marked CURRENT document what the code does today and pass.
import { describe, expect, it } from "vitest";
import { createLocalViewUrl } from "../src/local-view.js";

// Exactly what runDesktopApp's top-level catch does with the loadURL rejection
// (main.ts: `details: message` where message = error.stack).
const electronRejection = new Error(
  "ERR_CONNECTION_REFUSED (-102) loading 'http://127.0.0.1:47771/'",
);
electronRejection.stack =
  "Error: ERR_CONNECTION_REFUSED (-102) loading 'http://127.0.0.1:47771/'\n" +
  "    at rejectAndCleanup (node:electron/js2c/browser_init:2:89743)\n" +
  "    at WebContents.finishListener (node:electron/js2c/browser_init:2:89905)\n" +
  "    at WebContents.emit (node:events:509:28)";

function decodeDataUrl(url: string): string {
  const prefix = "data:text/html;charset=utf-8,";
  expect(url.startsWith(prefix)).toBe(true);
  return decodeURIComponent(url.slice(prefix.length));
}

describe("#1494 startup error view for an unreachable saved server target", () => {
  const html = decodeDataUrl(
    createLocalViewUrl({
      viewModel: {
        details: `${electronRejection.stack} Logs are under /tmp/x/logs/.`,
        kind: "error",
        logText: "",
        title: "Could not open bb",
      },
    }),
  );

  it("CURRENT: renders Electron internals as the user-facing message", () => {
    expect(html).toContain("node:electron/js2c/browser_init");
    expect(html).toContain("rejectAndCleanup");
  });

  it("CURRENT: forbids scripts, so no button could ever work here", () => {
    expect(html).toContain(
      `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'">`,
    );
    expect(html).not.toMatch(/<script/u);
  });

  it("EXPECTED (fails on main): offers a Retry / Use This Mac control", () => {
    expect(html).toMatch(/<button|<a /u);
    expect(html).toMatch(/Retry|This Mac|Window .* Server/u);
  });

  it("EXPECTED (fails on main): names the server instead of the stack", () => {
    expect(html).toContain("127.0.0.1:47771");
    expect(html).not.toContain("rejectAndCleanup");
  });
});
