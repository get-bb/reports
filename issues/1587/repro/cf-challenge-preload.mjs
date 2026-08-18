// Node preload (NODE_OPTIONS="--import <this file>") that makes the bb host
// daemon experience exactly what a Cloudflare-challenged network sees:
// every POST to https://chatgpt.com/backend-api/transcribe gets the real
// Cloudflare managed-challenge response captured on 2026-08-18
// (HTTP 403, cf-mitigated: challenge, HTML body, __cf_bm set-cookie).
// The interception is armed only while the flag file exists, so the same
// running instance can show the baseline (real network) and the failure.
//
// Configuration (environment, read when the daemon starts):
//   CF_PRELOAD_DIR     directory holding the flag file FORCE_CF_CHALLENGE and
//                      the append-only log cf-challenge-preload.log
//                      (default /tmp/bb-1587-preload; run-cli-transcribe.sh
//                      uses the same default)
//   CF_CHALLENGE_BODY  path of the captured HTML body
//                      (default: cf-challenge-body.html next to this file)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = process.env.CF_PRELOAD_DIR ?? "/tmp/bb-1587-preload";
const FLAG = path.join(DIR, "FORCE_CF_CHALLENGE");
const LOG = path.join(DIR, "cf-challenge-preload.log");
const BODY_FILE =
  process.env.CF_CHALLENGE_BODY ??
  path.join(path.dirname(fileURLToPath(import.meta.url)), "cf-challenge-body.html");
const TARGET = "https://chatgpt.com/backend-api/transcribe";
fs.mkdirSync(DIR, { recursive: true });

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
