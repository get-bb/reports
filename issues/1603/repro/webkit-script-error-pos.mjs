// In an old WebKit, load each given chunk with a <script type="module"> tag and
// report the window.onerror message + line/column, which pinpoints the exact
// position of a parse-time SyntaxError (dynamic import() hides the position).
// Usage: node webkit-script-error-pos.mjs <appUrl> <chunkName> [...]
import { webkit } from "playwright";
const [appUrl, ...chunks] = process.argv.slice(2);
const browser = await webkit.launch();
const page = await browser.newPage();
await page.goto(`${appUrl}/`, { waitUntil: "load" });
console.log("UA:", await page.evaluate(() => navigator.userAgent));
for (const c of chunks) {
  const r = await page.evaluate(
    (n) =>
      new Promise((resolve) => {
        const errs = [];
        const onErr = (e) => errs.push({ message: e.message, line: e.lineno, col: e.colno, url: e.filename });
        window.addEventListener("error", onErr);
        const s = document.createElement("script");
        s.type = "module";
        s.src = `/assets/${n}?probe=${Date.now()}`;
        s.onload = () => { window.removeEventListener("error", onErr); resolve({ ok: true, errs }); };
        s.onerror = () => { window.removeEventListener("error", onErr); resolve({ ok: false, errs }); };
        document.head.appendChild(s); setTimeout(() => resolve({ ok: null, errs }), 4000);
      }),
    c,
  );
  console.log(`== ${c}: ${r.ok ? "loaded" : "failed"}`);
  for (const e of r.errs) console.log(`   ${e.message} at ${e.url}:${e.line}:${e.col}`);
  if (r.errs.length) {
    const e = r.errs[0];
    const src = await (await fetch(`${appUrl}/assets/${c}`)).text();
    const lines = src.split("\n");
    const line = lines[e.line - 1] ?? "";
    console.log(`   context: …${line.slice(Math.max(0, e.col - 200), e.col + 100)}…`);
  }
}
await browser.close();
