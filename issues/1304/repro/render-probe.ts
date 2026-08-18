// Investigation-only instrumentation for #1304: counts component renders on
// window.__bbRenderCounts so a browser script can read them after typing.
// Place at apps/app/src/lib/render-probe.ts, then `git apply instrumentation.diff`.
declare global {
  interface Window {
    __bbRenderCounts?: Record<string, number>;
  }
}
export function renderProbe(name: string): void {
  if (typeof window === "undefined") return;
  const counts = (window.__bbRenderCounts ??= {});
  counts[name] = (counts[name] ?? 0) + 1;
}
