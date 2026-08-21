// Dump the React Query cache entries for file previews via the plugin runtime
// (globalThis.__bbPluginRuntime exposes the app's QueryClient to plugins).
const page = await browser.getPage("v2130");
const out = await page.evaluate(() => {
  const rt = globalThis.__bbPluginRuntime;
  const keys = rt ? Object.keys(rt) : [];
  let qc = null;
  const find = (o, depth) => {
    if (!o || depth > 3 || qc) return;
    for (const k of Object.keys(o)) {
      try {
        const v = o[k];
        if (v && typeof v.getQueryCache === "function") { qc = v; return; }
        if (v && typeof v === "object") find(v, depth + 1);
      } catch {}
    }
  };
  find(rt, 0);
  if (!qc) {
    // Walk the React fiber tree for a QueryClientProvider's `client` prop.
    const rootEl = document.getElementById("root") ?? document.body.firstElementChild;
    const fiberKey = Object.keys(rootEl).find((k) => k.startsWith("__reactContainer$") || k.startsWith("__reactFiber$"));
    const stack = [rootEl[fiberKey]];
    let guard = 0;
    while (stack.length && !qc && guard++ < 200000) {
      const f = stack.pop();
      if (!f) continue;
      const c = f.memoizedProps && f.memoizedProps.client;
      if (c && typeof c.getQueryCache === "function") { qc = c; break; }
      if (f.child) stack.push(f.child);
      if (f.sibling) stack.push(f.sibling);
    }
  }
  if (!qc) return { keys, error: "no query client found" };
  const rows = qc
    .getQueryCache()
    .getAll()
    .filter((q) => /FilePreview/i.test(String(q.queryKey[0])))
    .map((q) => ({
      key: JSON.stringify(q.queryKey).slice(0, 160),
      observers: q.observers.length,
      status: q.state.status,
      isInvalidated: q.state.isInvalidated,
      updatedAt: new Date(q.state.dataUpdatedAt).toTimeString().slice(0, 8),
      staleTime: q.observers[0]?.options?.staleTime ?? null,
      refetchOnWindowFocus: q.observers[0]?.options?.refetchOnWindowFocus ?? null,
    }));
  return { keys, rows };
});
out;
