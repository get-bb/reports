// Node preload (NODE_OPTIONS="--import <this file>") that makes the bb host
// daemon experience exactly what a Cloudflare-challenged network sees:
// every POST to https://chatgpt.com/backend-api/transcribe gets the real
// Cloudflare managed-challenge response captured on 2026-08-18
// (HTTP 403, cf-mitigated: challenge, HTML body, __cf_bm set-cookie).
// The interception is armed only while the FORCE flag file exists, so the same
// running instance can show the baseline (real network) and the failure.
import fs from "node:fs";

const FLAG = "/tmp/bb-reports/issues/1587/verify/FORCE_CF_CHALLENGE";
const LOG = "/tmp/bb-reports/issues/1587/verify/cf-challenge-preload.log";
const BODY_FILE = "/tmp/bb-reports/issues/1587/repro/cf-challenge-body.html";
const TARGET = "https://chatgpt.com/backend-api/transcribe";

const realFetch = globalThis.fetch;
globalThis.fetch = async function patchedFetch(input, init) {
  const url =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input.url;
  if (url === TARGET && fs.existsSync(FLAG)) {
    const headers = new Headers(init?.headers ?? {});
    fs.appendFileSync(
      LOG,
      `${new Date().toISOString()} pid=${process.pid} intercepted POST ${url} cookie=${JSON.stringify(headers.get("cookie"))} ua=${headers.get("user-agent")}\n`,
    );
    return new Response(fs.readFileSync(BODY_FILE), {
      status: 403,
      statusText: "Forbidden",
      headers: {
        "content-type": "text/html; charset=UTF-8",
        "cf-mitigated": "challenge",
        server: "cloudflare",
        "cf-ray": "a2cf3fb8fc1c64b6-SJC",
        "set-cookie":
          "__cf_bm=SIMULATED.CHALLENGE.COOKIE-1787038601; HttpOnly; SameSite=None; Secure; Path=/; Domain=chatgpt.com",
      },
    });
  }
  return realFetch(input, init);
};
