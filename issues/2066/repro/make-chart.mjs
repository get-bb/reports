// Renders assets/2066-heap.svg: V8 heap after forced GC, before vs after the
// 100-round append+refetch loop, for each measured run.
import { writeFileSync } from "node:fs";
// Sources: repro/measure-*.log (author, f02-17), verify/measure-*.log
// (independent verifier, f02-21), repro/revise/measure-*.log (author re-run
// with the portable measure.sh, f02-23).
const runs = [
  { label: "base fcada5a3b (author run 1)", before: 159.8, after: 179.2, color: "#2a78d6" },
  { label: "base fcada5a3b (author run 2)", before: 159.5, after: 181.3, color: "#2a78d6" },
  { label: "base fcada5a3b (verifier)", before: 160.1, after: 179.4, color: "#2a78d6" },
  { label: "base fcada5a3b (revise re-run)", before: 159.9, after: 181.6, color: "#2a78d6" },
  { label: "PR #2067 on base (author)", before: 160.0, after: 163.6, color: "#eb6834" },
  { label: "PR #2067 on base (verifier)", before: 159.8, after: 165.8, color: "#eb6834" },
  { label: "PR #2067 on base (revise re-run)", before: 160.5, after: 164.1, color: "#eb6834" },
  { label: "proposed fix on base (revise)", before: 159.1, after: 166.0, color: "#2e9e5b" },
];
const W = 960, H = 560, PL = 230, PR_ = 250, PT = 60, PB = 40;
const iw = W - PL - PR_, ih = H - PT - PB;
const lo = 150, hi = 190;
const x = (v) => PL + ((v - lo) / (hi - lo)) * iw;
const rowH = ih / runs.length;
let marks = "";
runs.forEach((r, i) => {
  const y0 = PT + i * rowH + 10;
  const bh = (rowH - 20) / 2 - 2;
  marks += `<text x="${PL - 12}" y="${y0 + bh + 4}" text-anchor="end" fill="#0b0b0b">${r.label}</text>`;
  marks += `<rect x="${x(lo)}" y="${y0}" width="${x(r.before) - x(lo)}" height="${bh}" rx="0" fill="${r.color}" opacity="0.35"/>`;
  marks += `<text x="${x(r.before) + 6}" y="${y0 + bh - 3}" fill="#52514e">before · ${r.before.toFixed(1)} MB</text>`;
  marks += `<rect x="${x(lo)}" y="${y0 + bh + 4}" width="${x(r.after) - x(lo)}" height="${bh}" rx="0" fill="${r.color}"/>`;
  marks += `<text x="${x(r.after) + 6}" y="${y0 + 2 * bh + 1}" fill="#0b0b0b" font-weight="600">after · ${r.after.toFixed(1)} MB (+${(r.after - r.before).toFixed(1)})</text>`;
});
const ticks = [150, 160, 170, 180, 190];
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="system-ui,-apple-system,Segoe UI,sans-serif" font-size="12">
<rect width="${W}" height="${H}" fill="#fcfcfb"/>
<text x="${PL - 170}" y="22" font-size="14" font-weight="600" fill="#0b0b0b">bb server V8 heap after forced full GC, before vs after 100 append+refetch rounds</text>
<text x="${PL - 170}" y="40" fill="#52514e">One 9,001-event thread; each round appends one event then GETs the timeline. 99–199 rows/response; axis starts at 150 MB.</text>
${ticks.map((v) => `<line x1="${x(v)}" x2="${x(v)}" y1="${PT}" y2="${PT + ih}" stroke="#e6e6e2"/><text x="${x(v)}" y="${PT + ih + 16}" text-anchor="middle" fill="#52514e">${v}</text>`).join("\n")}
<text x="${PL + iw / 2}" y="${H - 8}" text-anchor="middle" fill="#52514e">Runtime.getHeapUsage().usedSize after HeapProfiler.collectGarbage (MB)</text>
${marks}
</svg>`;
writeFileSync("/tmp/bb-reports/issues/assets/2066-heap.svg", svg);
console.log("wrote /tmp/bb-reports/issues/assets/2066-heap.svg");
