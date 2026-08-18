// dev-browser script (QuickJS sandbox: no process/env/fs). Open a thread page
// from the *production* build served by serve-prod-build.mjs and record every
// JS chunk the browser fetched, in order, with sizes.
//
// Do NOT run this file directly: run browser-thread-page-loads.sh, which
// substitutes __THREAD_URL__ below with your own project/thread URL:
//   bash browser-thread-page-loads.sh <project id> <thread id> [port=18999]
// (project id: from the POST /api/v1/projects response; thread id: "id" in
// `bb thread spawn ... --json`.)
//
// waitUntil is "load" plus a fixed 6 s wait: "networkidle" never fires while
// the thread's WebSocket / long-poll traffic is active and times out.
const url = "__THREAD_URL__";
const page = await browser.getPage("thread1072");
await page.setViewportSize({ width: 1280, height: 800 });
const t0 = Date.now();
await page.goto(url, { waitUntil: "load", timeout: 25000 });
const t1 = Date.now();
await page.waitForTimeout(6000);
const shot = await page.screenshot();
await saveScreenshot(shot, "1072-thread-page.png");
const perf = await page.evaluate(() => performance.getEntriesByType("resource").filter(e => e.name.includes("/assets/") && e.name.endsWith(".js")).map(e => ({ file: e.name.split("/assets/")[1], start: Math.round(e.startTime), end: Math.round(e.responseEnd), size: e.decodedBodySize })));
const preloaded = await page.evaluate(() => Array.from(document.querySelectorAll('link[rel="modulepreload"]')).map(l => l.getAttribute("href").split("/assets/")[1]));
console.log(JSON.stringify({ url, loadMs: t1 - t0, preloaded, perf: perf.sort((a,b)=>a.start-b.start), totalDecodedBytes: perf.reduce((a,e)=>a+e.size,0) }, null, 1));
