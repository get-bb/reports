#!/usr/bin/env node
// Serves the *production* build in apps/app/dist (with SPA fallback) and
// proxies /api (HTTP + WebSocket) to a running bb server, so a browser can
// load the real chunked bundle instead of Vite's unbundled dev server.
// Usage: node serve-prod-build.mjs <apps/app/dist> <listen port> <bb server url>
import http from "node:http";
import net from "node:net";
import fs from "node:fs";
import path from "node:path";

const [distDir, portArg, serverUrlArg] = process.argv.slice(2);
const port = Number(portArg ?? 18999);
const serverUrl = new URL(serverUrlArg ?? "http://localhost:26591");
const mime = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".svg": "image/svg+xml", ".png": "image/png", ".woff2": "font/woff2", ".woff": "font/woff", ".ttf": "font/ttf", ".webmanifest": "application/manifest+json", ".ico": "image/x-icon" };

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  if (url.pathname.startsWith("/api")) {
    const proxied = http.request({ host: serverUrl.hostname, port: serverUrl.port, method: req.method, path: req.url,
      headers: { ...req.headers, host: `${serverUrl.hostname}:${serverUrl.port}` } }, (r) => {
      res.writeHead(r.statusCode, r.headers);
      r.pipe(res);
    });
    proxied.on("error", (e) => { res.writeHead(502); res.end(String(e)); });
    req.pipe(proxied);
    return;
  }
  let file = path.join(distDir, decodeURIComponent(url.pathname));
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    if (url.pathname.startsWith("/assets/")) { res.writeHead(404); res.end("missing"); return; }
    file = path.join(distDir, "index.html");
  }
  const ext = path.extname(file);
  res.writeHead(200, { "content-type": mime[ext] ?? "application/octet-stream",
    "cache-control": ext === ".html" ? "no-store" : "public, max-age=31536000, immutable" });
  fs.createReadStream(file).pipe(res);
});
server.on("upgrade", (req, socket, head) => {
  const upstream = net.connect(Number(serverUrl.port), serverUrl.hostname, () => {
    const lines = [`${req.method} ${req.url} HTTP/1.1`];
    for (const [k, v] of Object.entries(req.headers)) lines.push(`${k}: ${k === "host" ? `${serverUrl.hostname}:${serverUrl.port}` : v}`);
    upstream.write(lines.join("\r\n") + "\r\n\r\n");
    if (head.length) upstream.write(head);
    socket.pipe(upstream); upstream.pipe(socket);
  });
  upstream.on("error", () => socket.destroy());
  socket.on("error", () => upstream.destroy());
});
server.listen(port, "127.0.0.1", () => console.log(`serving ${distDir} on http://127.0.0.1:${port} -> api ${serverUrl}`));
