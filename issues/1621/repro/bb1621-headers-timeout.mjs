// Demonstrates Node's default undici headersTimeout (300 s) — the same
// `fetch()` the bb CLI uses for POST /api/v1/plugins/:id/cli.
import http from "node:http";
const server = http.createServer(() => { /* never respond */ });
server.listen(0, "127.0.0.1", async () => {
  const port = server.address().port;
  const started = Date.now();
  try {
    await fetch(`http://127.0.0.1:${port}/hang`, { method: "POST", body: "{}" });
  } catch (err) {
    console.log(JSON.stringify({
      elapsedS: Math.round((Date.now() - started) / 1000),
      message: err.message,
      causeName: err.cause?.name,
      causeCode: err.cause?.code,
      causeMessage: err.cause?.message,
    }));
  }
  server.close();
});
