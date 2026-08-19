// Fake Anthropic API that answers every request with HTTP 429 + the unified
// rate-limit headers Claude Code turns into a `rate_limit_event` (status
// "rejected"). Point Claude Code at it with ANTHROPIC_BASE_URL.
//   node fake-429.mjs <port>
import http from "node:http";
const port = Number(process.argv[2] ?? 45929);
const resetsAt = Math.floor(Date.now() / 1000) + 3 * 3600;
let n = 0;
http
  .createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      n += 1;
      console.log(`[fake-429] #${n} ${req.method} ${req.url} (${body.length} bytes)`);
      res.writeHead(429, {
        "content-type": "application/json",
        "anthropic-ratelimit-unified-status": "rejected",
        "anthropic-ratelimit-unified-reset": String(resetsAt),
        "anthropic-ratelimit-unified-5h-status": "rejected",
        "anthropic-ratelimit-unified-5h-reset": String(resetsAt),
        "anthropic-ratelimit-unified-representative-claim": "five_hour",
        "anthropic-ratelimit-unified-overage-status": "rejected",
        "anthropic-ratelimit-unified-overage-disabled-reason": "org_level_disabled",
        "retry-after": "10800",
        "request-id": `req_fake_${n}`,
      });
      res.end(
        JSON.stringify({
          type: "error",
          error: {
            type: "rate_limit_error",
            message: "You've hit your session limit - resets 2:40pm",
          },
          request_id: `req_fake_${n}`,
        }),
      );
    });
  })
  .listen(port, "127.0.0.1", () =>
    console.log(`[fake-429] listening on ${port}`),
  );
