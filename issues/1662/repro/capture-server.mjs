// Tiny HTTP sink: prints the method, path and JSON body of every request the
// bb CLI sends, then answers /api/v1/plugins/install with the exact 422 body a
// pre-0.38.0 (pre-fc3454809) bb server returns, so the CLI shows what a user
// hitting an older running server sees.
// Usage: node capture-server.mjs 25799
import { createServer } from "node:http";
const port = Number(process.argv[2] ?? 25799);
createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    console.log(`${req.method} ${req.url}\n${body}`);
    if (req.url === "/api/v1/plugins/install") {
      res.writeHead(422, { "content-type": "application/json" });
      res.end(
        JSON.stringify({ ok: false, error: 'expected { "source": string }' }),
      );
      return;
    }
    res.writeHead(200, { "content-type": "application/json" });
    res.end("[]");
  });
}).listen(port, () => console.log(`capture server on ${port}`));
