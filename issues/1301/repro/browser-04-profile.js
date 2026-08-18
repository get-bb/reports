// dev-browser script: CPU-profile a single older-page prepend via CDP and print
// the top self-time frames plus how much of the wall time was React render/commit
// vs. browser layout. Also measures the "empty" cost of scrolling with no load.
const page = await browser.getPage("thread");
await page.setViewportSize({ width: 390, height: 844 });
await page.goto("http://localhost:13028/projects/proj_mgvp7iamvh/threads/thr_wfjb5qctw4", { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(2500);
const cdp = await page.context().newCDPSession(page);
await cdp.send("Profiler.enable");
await cdp.send("Profiler.setSamplingInterval", { interval: 200 });

async function profileOnePage(label) {
  const before = await page.evaluate(() => document.querySelectorAll("[data-timeline-row-id]").length);
  await cdp.send("Profiler.start");
  const t0 = Date.now();
  await page.evaluate(() => { const el = document.querySelector(".thread-scrollbar"); el.scrollTop = 0; });
  // wait for one page to land
  await page.waitForFunction((n) => document.querySelectorAll("[data-timeline-row-id]").length > n, before, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(700);
  const { profile } = await cdp.send("Profiler.stop");
  const after = await page.evaluate(() => document.querySelectorAll("[data-timeline-row-id]").length);
  // aggregate self time by function
  const byId = new Map(profile.nodes.map((n) => [n.id, n]));
  const self = new Map();
  const dt = profile.timeDeltas; const samples = profile.samples;
  let total = 0;
  for (let i = 0; i < samples.length; i++) {
    const n = byId.get(samples[i]); const d = (dt[i] || 0) / 1000; total += d;
    const cf = n.callFrame; const url = (cf.url || "").split("/").slice(-1)[0].split("?")[0];
    const key = (cf.functionName || "(anon)") + " @ " + url + ":" + cf.lineNumber;
    self.set(key, (self.get(key) || 0) + d);
  }
  const top = [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30).map(([k, v]) => v.toFixed(1) + "ms  " + k);
  // bucket by url
  const byUrl = new Map();
  for (let i = 0; i < samples.length; i++) { const n = byId.get(samples[i]); const d = (dt[i] || 0) / 1000; const url = (n.callFrame.url || "(native/" + n.callFrame.functionName + ")").split("/").slice(-1)[0].split("?")[0]; byUrl.set(url, (byUrl.get(url) || 0) + d); }
  const urls = [...byUrl.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15).map(([k, v]) => v.toFixed(1) + "ms  " + k);
  console.log(`=== ${label}: rows ${before} -> ${after}, sampled ${total.toFixed(0)}ms ===`);
  console.log(top.join("\n"));
  console.log("--- by script ---\n" + urls.join("\n"));
  await writeFile(`1301-profile-${label}.cpuprofile`, JSON.stringify(profile));
}
await profileOnePage("page1");
await profileOnePage("page2");
// load the rest to make the loaded window large, then profile again
for (let i = 0; i < 6; i++) { await page.evaluate(() => { document.querySelector(".thread-scrollbar").scrollTop = 0; }); await page.waitForTimeout(1500); }
await profileOnePage("pageLate");
