/**
 * Repro for get-bb/bb#1662.
 *
 * `bb plugin install <path>` builds its request through
 * `sdk.plugins.install`. Since fc3454809 (bb-app 0.38.0) the SDK always
 * sends `selection: { kind: "root" }` even when the caller asked for nothing
 * but a plain root install. Every server released before that commit
 * (bb-app <= 0.37.x) validates the install body with a *strict* schema that
 * only knows `source`, so the extra key is rejected with
 * HTTP 422 `expected { "source": string }` -- while a hand-written
 * `curl -d '{"source": ...}'` succeeds against the very same server.
 *
 * The first test FAILS on 16ceb3a54 (and on 0.38.0): it captures the body the
 * SDK really sends and parses it with the pre-0.38.0 route schema (copied
 * verbatim from packages/server-contract/src/api/plugins.ts at
 * 1c3f3eff0, the parent of fc3454809).
 */
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createBbSdk } from "../src/core.js";
import { createHttpTransport } from "../src/transport-http.js";
import type { FetchImplementation } from "../src/response.js";

// packages/server-contract/src/api/plugins.ts @ 1c3f3eff0 (bb-app 0.37.x):
const legacyPluginInstallRequestSchema = z
  .object({ source: z.string().min(1) })
  .strict();

async function captureInstallBody(
  args: Parameters<
    ReturnType<typeof createBbSdk>["plugins"]["install"]
  >[0],
): Promise<unknown> {
  let captured: unknown;
  const fetch: FetchImplementation = async (_input, init) => {
    captured = JSON.parse(String(init?.body));
    // Mimic a bb-app 0.37.x server: strict `{ source }` only.
    const ok = legacyPluginInstallRequestSchema.safeParse(captured).success;
    return new Response(
      JSON.stringify(
        ok
          ? { ok: true, plugin: {} }
          : { ok: false, error: 'expected { "source": string }' },
      ),
      { status: ok ? 200 : 422, headers: { "content-type": "application/json" } },
    );
  };
  const sdk = createBbSdk({
    transport: createHttpTransport({
      baseUrl: "http://bb.test",
      fetch,
      runtime: "node",
    }),
  });
  // The response is a stub, so the SDK's response parsing may throw; only the
  // request body matters here.
  await sdk.plugins.install(args).catch(() => undefined);
  return captured;
}

describe("issue #1662: plugin install request body vs pre-0.38.0 servers", () => {
  it("a plain root install sends only { source } (accepted by <=0.37.x servers)", async () => {
    const body = await captureInstallBody({ source: "path:/tmp/my-plugin" });
    // FAILS on 16ceb3a54: body is
    //   {"source":"path:/tmp/my-plugin","selection":{"kind":"root"}}
    // and the strict legacy schema reports: Unrecognized key(s) in object: 'selection'
    expect(legacyPluginInstallRequestSchema.safeParse(body)).toMatchObject({
      success: true,
    });
  });

  it("a subdirectory install still sends an explicit selection", async () => {
    const body = await captureInstallBody({
      source: "git:github.com/acme/plugins",
      subdirectory: "packages/notes",
    });
    expect(body).toEqual({
      source: "git:github.com/acme/plugins",
      selection: { kind: "subdirectory", path: "packages/notes" },
    });
  });
});
