// Usage: dev-browser --headless run db-probe.js
// Inputs (in ~/.dev-browser/tmp): probe-url.txt (URL), probe-shot.txt (screenshot prefix), probe-times.txt (optional, ms after goto).
// Installs an 8ms DOM sampler right after navigation commit (before the Vite module graph has painted anything), navigates, and prints
// every transition of a small set of markers with the time since navigationStart.
const url = (await readFile("probe-url.txt")).trim();
const shotName = (await readFile("probe-shot.txt")).trim();
const page = await browser.getPage("bb");
await page.setViewportSize({width: 1280, height: 800});
const PROBE = `(() => {
  const MARKERS = [
    "No projects yet",
    "This plugin panel is not available",
    "Loading models",
    "Extra High",
    "5.6-Sol",
    "Medium",
    "Reply only with ok",
    "1676 target",
    "Tasks",
    "Automations",
    "No tasks yet",
    "Could not load models",
    "not available",
  ];
  window.__probe = [];
  let last = "";
  const sample = () => {
    const body = document.body;
    if (!body) return;
    const text = body.innerText || "";
    const state = {
      t: Math.round(performance.now()),
      pulse: document.querySelectorAll(".animate-pulse").length,
      header: (document.querySelector("p.truncate.text-sm.font-semibold")?.innerText || "").replace(/[ \\n\\t]+/g, " ").slice(0, 80),
      markers: MARKERS.filter((m) => text.includes(m)),
      main: (document.querySelector("main")?.innerText || "").replace(/[ \\n\\t]+/g, " ").slice(0, 120),
    };
    const key = JSON.stringify([state.pulse, state.header, state.markers, state.main]);
    if (key !== last) {
      last = key;
      window.__probe.push(state);
    }
  };
  setInterval(sample, 8);
})();`;
// Request delays are done server-side: write {"match":"<url substring>","ms":N} to
// /tmp/bb-reports/issues/1676/repro/delay.json (read by the qaDelayPlugin added to apps/app/vite.dev.config.ts).
await page.goto(url, {waitUntil: "commit"});
const installedAt = await page.evaluate(PROBE + "; performance.now()");
console.log("probe installed at", installedAt, "ms; root children:", await page.evaluate("document.getElementById('root').childElementCount"));
// timed screenshots after navigation (probe-times.txt = comma-separated ms since goto)
let times = [];
try { times = (await readFile("probe-times.txt")).trim().split(",").map(Number).filter((n) => n > 0); } catch (e) {}
const shots = [];
const t0 = Date.now();
for (const at of times) {
  const wait = at - (Date.now() - t0);
  if (wait > 0) await page.waitForTimeout(wait);
  const tPage = await page.evaluate("Math.round(performance.now())");
  const p = await saveScreenshot(await page.screenshot(), `${shotName}-at${at}.png`);
  shots.push(`${p} (page time ${tPage} ms)`);
}
await page.waitForTimeout(3000);
await saveScreenshot(await page.screenshot(), `${shotName}-settled.png`);
const probe = await page.evaluate(() => window.__probe);
console.log(JSON.stringify(probe, null, 1));
console.log(shots.join("\n"));
