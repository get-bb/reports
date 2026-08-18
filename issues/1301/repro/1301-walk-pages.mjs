const base = "http://localhost:21028";
const threadId = process.argv[2] ?? "thr_wfjb5qctw4";
let url = `${base}/api/v1/threads/${threadId}/timeline`;
let page = 0, total = 0, bytes = 0;
for (;;) {
  const t0 = performance.now();
  const res = await fetch(url);
  const text = await res.text();
  const ms = (performance.now() - t0).toFixed(0);
  const body = JSON.parse(text); if (!body.rows) { console.log("ERR", res.status, url, text.slice(0,300)); break; }
  page += 1; total += body.rows.length; bytes += text.length;
  const c = body.timelinePage.olderCursor;
  console.log(`page ${page} rows=${body.rows.length} bytes=${text.length} ms=${ms} olderCursor=${JSON.stringify(c)}`);
  if (!c) break;
  url = `${base}/api/v1/threads/${threadId}/timeline?beforeAnchorSeq=${c.anchorSeq}&beforeAnchorId=${encodeURIComponent(c.anchorId)}`;
}
console.log(`TOTAL pages=${page} rows=${total} bytes=${bytes}`);
