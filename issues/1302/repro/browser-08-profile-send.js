// CPU-profile the app page (6x CPU throttle) while one message is sent to the
// open thread via the server API, then aggregate self-time by script URL and
// print the top functions. Also records long tasks (>50ms).
const SERVER = "http://localhost:23464";
const THREAD = "thr_mfe9vetq34";
const page = await browser.getPage("bb1302");
const cdp = await page.context().newCDPSession(page);
await page.evaluate(() => {
  window.__longTasks = [];
  const obs = new PerformanceObserver((list) => {
    for (const e of list.getEntries()) window.__longTasks.push({ start: Math.round(e.startTime), dur: Math.round(e.duration) });
  });
  obs.observe({ type: "longtask", buffered: false });
  window.__apiLog.length = 0;
});
await cdp.send("Emulation.setCPUThrottlingRate", { rate: 6 });
await cdp.send("Profiler.enable");
await cdp.send("Profiler.setSamplingInterval", { interval: 500 });
await cdp.send("Profiler.start");
const t0 = await page.evaluate(() => performance.now());
await page.evaluate(async (args) => {
  await fetch(`${args.SERVER}/api/v1/threads/${args.THREAD}/send`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ input: [{ type: "text", text: "Reply only with ok.", mentions: [] }], mode: "steer-if-active" }),
  });
}, { SERVER, THREAD });
// wait until the sidebar-bootstrap has been refetched twice (turn start + turn end)
await page.waitForFunction(
  () => window.__apiLog.filter((e) => e.url.includes("sidebar-bootstrap")).length >= 2,
  undefined,
  { timeout: 90000, polling: 500 },
);
await page.waitForTimeout(3000);
const t1 = await page.evaluate(() => performance.now());
const { profile } = await cdp.send("Profiler.stop");
await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });

// aggregate self time
const nodes = new Map(profile.nodes.map((n) => [n.id, n]));
const selfByFn = new Map();
const selfByUrl = new Map();
let total = 0;
for (let i = 0; i < profile.samples.length; i++) {
  const n = nodes.get(profile.samples[i]);
  const dt = (profile.timeDeltas[i] || 0) / 1000;
  total += dt;
  const cf = n.callFrame;
  const url = (cf.url || "(native)").replace(/^http:\/\/[^/]+/, "").replace(/\?.*$/, "");
  const key = `${cf.functionName || "(anonymous)"} ${url}:${cf.lineNumber}`;
  selfByFn.set(key, (selfByFn.get(key) || 0) + dt);
  selfByUrl.set(url, (selfByUrl.get(url) || 0) + dt);
}
const top = (m, n) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => `${v.toFixed(1).padStart(8)}ms  ${k}`).join("\n");
console.log(`window ${Math.round(t1 - t0)}ms, sampled ${total.toFixed(0)}ms (incl. idle)`);
console.log("--- self time by script url (top 25) ---");
console.log(top(selfByUrl, 25));
console.log("--- self time by function (top 40) ---");
console.log(top(selfByFn, 40));
console.log("--- api calls ---");
const log = await page.evaluate(() => window.__apiLog);
for (const e of log) console.log(`${e.method} ${e.url} -> ${e.bytes} bytes (${e.ms}ms)`);
console.log("--- long tasks (>50ms) ---");
console.log(JSON.stringify(await page.evaluate(() => window.__longTasks)));
await writeFile("1302-profile.cpuprofile", JSON.stringify(profile));
