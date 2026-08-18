// Screenshot the first Electron page via the Chrome DevTools Protocol and dump
// what the page shows (text + count of interactive controls).
// Usage: node cdp-screenshot.mjs <cdp-port> <out.png>
const [port, out] = process.argv.slice(2);
const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
const page = targets.find((t) => t.type === "page");
if (!page) throw new Error("no page target");
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0;
const pending = new Map();
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
  }
};
const send = (method, params = {}) =>
  new Promise((resolve) => {
    const i = ++id;
    pending.set(i, resolve);
    ws.send(JSON.stringify({ id: i, method, params }));
  });
const evaluate = async (expression) =>
  (await send("Runtime.evaluate", { expression, returnByValue: true })).result
    ?.result?.value;
process.stdout.write(`URL: ${page.url.slice(0, 60)}...\n`);
process.stdout.write(`BODY TEXT:\n${await evaluate("document.body.innerText")}\n`);
process.stdout.write(
  `interactive controls on page: ${await evaluate("document.querySelectorAll('button,a,input,[role=button]').length")}\n`,
);
const shot = await send("Page.captureScreenshot", { format: "png" });
const { writeFileSync } = await import("node:fs");
writeFileSync(out, Buffer.from(shot.result.data, "base64"));
process.stdout.write(`wrote ${out}\n`);
ws.close();
