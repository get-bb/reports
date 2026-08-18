// Compare, under 6x CPU throttling, the client cost of
//  (a) a full sidebar-bootstrap refetch after one thread row changed server-side
//      (what main does today on every status-changed push), versus
//  (b) patching that one row in the react-query cache with setQueryData
//      (what the issue proposes).
// The QueryClient is pulled out of the React fiber tree (dev build).
// Before each (a) iteration the caller must have changed one row server-side;
// this script does it by asking the daemon-side helper via a marker file is
// not possible from the sandbox, so instead we alternate a *pin* on a seeded
// thread through the public API with realtime effects allowed to settle first.
const SERVER = "http://localhost:23464";
const page = await browser.getPage("bb1302");
const cdp = await page.context().newCDPSession(page);

const helpers = `
  window.__qc = (() => {
    const root = document.getElementById("root");
    const key = Object.keys(root).find((k) => k.startsWith("__reactContainer$"));
    let fiber = root[key];
    const seen = new Set();
    const stack = [fiber];
    while (stack.length) {
      const f = stack.pop();
      if (!f || seen.has(f)) continue;
      seen.add(f);
      const c = f.memoizedProps && f.memoizedProps.client;
      if (c && typeof c.getQueryCache === "function") return c;
      stack.push(f.child, f.sibling);
    }
    return null;
  })();
  window.__twoFrames = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 0))));
  window.__renders = 0;
`;
await page.evaluate(helpers);
console.log("queryClient found:", await page.evaluate(() => Boolean(window.__qc)));

// pick a seeded thread visible in the sidebar (first project, first thread)
const target = await page.evaluate(() => {
  const d = window.__qc.getQueryData(["sidebarNavigation"]);
  const p = d.projects.find((p) => p.threads.length > 0);
  return { projectId: p.id, threadId: p.threads[0].id, title: p.threads[0].title };
});
console.log("target row:", JSON.stringify(target));

await cdp.send("Emulation.setCPUThrottlingRate", { rate: 6 });

async function measureRefetch() {
  return page.evaluate(async () => {
    const qc = window.__qc;
    const before = qc.getQueryData(["sidebarNavigation"]);
    const t0 = performance.now();
    await qc.refetchQueries({ queryKey: ["sidebarNavigation"], exact: true });
    const t1 = performance.now();
    await window.__twoFrames();
    const t2 = performance.now();
    const after = qc.getQueryData(["sidebarNavigation"]);
    return { fetchParseShareMs: +(t1 - t0).toFixed(1), plusRenderMs: +(t2 - t0).toFixed(1), rootIdentityChanged: before !== after };
  });
}
async function measurePatch(threadId, flip) {
  return page.evaluate(async ({ threadId, flip }) => {
    const qc = window.__qc;
    const t0 = performance.now();
    qc.setQueryData(["sidebarNavigation"], (d) => ({
      ...d,
      projects: d.projects.map((p) =>
        p.threads.some((t) => t.id === threadId)
          ? { ...p, threads: p.threads.map((t) => (t.id === threadId ? { ...t, status: flip ? "active" : "idle", runtime: { ...t.runtime, displayStatus: flip ? "active" : "idle" } } : t)) }
          : p,
      ),
    }));
    const t1 = performance.now();
    await window.__twoFrames();
    const t2 = performance.now();
    return { patchMs: +(t1 - t0).toFixed(1), plusRenderMs: +(t2 - t0).toFixed(1) };
  }, { threadId, flip });
}

const refetch = [];
const patch = [];
for (let i = 0; i < 4; i++) {
  // change one row server-side so the refetched payload really differs
  await page.evaluate(async ({ SERVER, threadId, i }) => {
    await fetch(`${SERVER}/api/v1/threads/${threadId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: `Perf row ${i}` }),
    });
  }, { SERVER, threadId: target.threadId, i });
  await page.waitForTimeout(1500); // let realtime-triggered refetches settle
  refetch.push(await measureRefetch());
  patch.push(await measurePatch(target.threadId, i % 2 === 0));
}
await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
console.log("(a) full refetch after one changed row, 6x cpu:", JSON.stringify(refetch));
console.log("(b) setQueryData patch of one row, 6x cpu:", JSON.stringify(patch));
// restore title
await page.evaluate(async ({ SERVER, threadId, title }) => {
  await fetch(`${SERVER}/api/v1/threads/${threadId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ title }) });
}, { SERVER, threadId: target.threadId, title: target.title });
