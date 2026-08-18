// Repro for get-bb/bb#1587: "Transcription often fails with HTTP 403 due to
// cloudflare when using codex subscription".
//
// The daemon sends ChatGPT-subscription transcription to
// https://chatgpt.com/backend-api/transcribe, which sits behind Cloudflare
// bot management (managed challenge). When Cloudflare challenges the request
// (HTTP 403 + `cf-mitigated: challenge` + HTML), the daemon retries exactly
// once with the Cloudflare cookies and, if that is challenged too, gives up
// with the generic non-transient code `codex_request_failed` and a message
// containing the raw challenge HTML. The server treats `codex_request_failed`
// as permanent (isTransientInferenceError -> false), so `bb voice transcribe`
// fails on the first attempt with:
//   HTTP 502: Codex transcription request failed with HTTP 403: <html> <head> ...
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { resetChatGptCloudflareCookiesForTests } from "./chatgpt-cloudflare-cookies.js";
import { transcribeCodexVoice } from "./codex-chatgpt-client.js";

// Real Cloudflare managed-challenge body captured from
// https://chatgpt.com/backend-api/transcribe on 2026-08-18 (see
// /tmp/bb-reports/issues/1587/repro/cf-challenge-body.html). Only the head is
// needed here; the daemon truncates the message to 400 chars anyway.
const CF_CHALLENGE_HTML = `<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style global>body{font-family:Arial,Helvetica,sans-serif}.container{align-items:center;display:flex;flex-direction:column;gap:2rem;height:100%;justify-content:center;width:100%}@keyframes enlarge-appear{0%{opacity:0;transform:scale(75%) rotate(-90deg)}to{opacity:1;transform:scale(100%) rotate(0deg)}}.logo{color:#8e8ea0}</style>
    <title>Just a moment...</title>
    <script src="/cdn-cgi/challenge-platform/h/b/orchestrate/chl_page/v1?ray=a2cf3fb8fc1c64b6"></script>
  </head>
  <body><div class="container"><div class="data">Verifying you are human.</div></div></body>
</html>`;

function cloudflareChallengeResponse(): Response {
  return new Response(CF_CHALLENGE_HTML, {
    status: 403,
    headers: {
      "content-type": "text/html; charset=UTF-8",
      "cf-mitigated": "challenge",
      server: "cloudflare",
      "set-cookie":
        "__cf_bm=cloudflare-cookie; HttpOnly; SameSite=None; Secure; Path=/; Domain=chatgpt.com",
    },
  });
}

function base64UrlJson(value: object): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

async function writeChatGptAuth(): Promise<string> {
  const homeDir = await fs.mkdtemp(path.join(os.tmpdir(), "bb-1587-"));
  vi.stubEnv("HOME", homeDir);
  vi.stubEnv("CODEX_HOME", path.join(homeDir, ".codex"));
  const accessToken = `${base64UrlJson({ alg: "none" })}.${base64UrlJson({
    exp: Math.floor(Date.now() / 1000) + 3600,
    "https://api.openai.com/auth": { chatgpt_account_id: "account-123" },
  })}.sig`;
  await fs.mkdir(path.join(homeDir, ".codex"), { recursive: true });
  await fs.writeFile(
    path.join(homeDir, ".codex", "auth.json"),
    JSON.stringify({
      auth_mode: "chatgpt",
      tokens: { access_token: accessToken, refresh_token: "r", account_id: "account-123" },
    }),
  );
  return homeDir;
}

async function runTranscribe(): Promise<{ code: string; message: string }> {
  try {
    await transcribeCodexVoice({
      type: "codex.voice.transcribe",
      model: "gpt-transcribe",
      audioBase64: Buffer.from("audio").toString("base64"),
      mimeType: "audio/mpeg",
      filename: "tone.mp3",
      prompt: null,
      timeoutMs: 10_000,
    });
  } catch (error) {
    const e = error as { code: string; message: string };
    return { code: e.code, message: e.message };
  }
  throw new Error("expected transcribeCodexVoice to reject");
}

describe("#1587 ChatGPT transcription behind a Cloudflare challenge", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    resetChatGptCloudflareCookiesForTests();
  });

  it("documents current behavior: one cookie retry, then a permanent codex_request_failed carrying raw HTML", async () => {
    await writeChatGptAuth();
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock.mockImplementation(async () => cloudflareChallengeResponse());
    vi.stubGlobal("fetch", fetchMock);

    const failure = await runTranscribe();

    // Exactly two fetches: original + one retry that re-sends the __cf_bm
    // cookie. A JS-less client can never obtain cf_clearance, so if the retry
    // is challenged too the request is dead.
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const retryHeaders = new Headers(fetchMock.mock.calls[1]?.[1]?.headers);
    expect(retryHeaders.get("cookie")).toBe("__cf_bm=cloudflare-cookie");
    // 403 is not mapped by codexRequestErrorCode(); it becomes the generic,
    // non-transient code and the message embeds the challenge page.
    expect(failure.code).toBe("codex_request_failed");
    expect(failure.message).toContain(
      "Codex transcription request failed with HTTP 403: <html> <head> <meta name=\"viewport\"",
    );
  });

  it("EXPECTED (fails on main): a Cloudflare challenge is transient and must not leak the challenge HTML", async () => {
    await writeChatGptAuth();
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock.mockImplementation(async () => cloudflareChallengeResponse());
    vi.stubGlobal("fetch", fetchMock);

    const failure = await runTranscribe();

    // The server only retries / falls back on codex_service_unavailable,
    // codex_rate_limited and timeouts (apps/server/src/services/ai/inference.ts
    // isTransientInferenceError). A bot-management challenge is exactly that
    // kind of transient, environment-dependent failure.
    expect(failure.code).toBe("codex_service_unavailable"); // <-- FAILS on main: "codex_request_failed"
    expect(failure.message).not.toContain("<html>"); // <-- FAILS on main
  });
});
