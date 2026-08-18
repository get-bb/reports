/**
 * Issue #1621 mechanism repro.
 *
 * A Hono handler that returns a Response whose header dictionary carries a
 * non-Latin-1 character (U+2014 em dash) does not fail at construction time:
 * @hono/node-server's lightweight Response defers `new Headers()` until the
 * headers are first read. With the production middleware stack (cors +
 * compress + onError -> errorToResponse) the deferred TypeError surfaces in
 * `get headers` <- `set res` <- `dispatch`, is logged once per middleware
 * level at or outside `compress` plus once for compress itself, and the
 * client gets the generic JSON 500 instead of a structured error.
 *
 * In bb the bundled tasks plugin reaches this path via its attachment
 * download route (Content-Disposition carries the raw file name); see
 * plugins/tasks/attachments/issue-1621-non-latin1-filename.test.ts.
 */
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { compress } from "hono/compress";
import { cors } from "hono/cors";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { errorToResponse } from "../src/errors.js";

const EM_DASH_TEXT = "Testing the transport — an em dash is here";
const logged: Array<{ message: string; stack: string }> = [];
const logger = {
  error: (fields: { err?: unknown }, message: string) => {
    const err = fields.err;
    logged.push({
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? (err.stack ?? "") : "",
    });
    void message;
  },
  warn: () => {},
  info: () => {},
  debug: () => {},
} as unknown as Parameters<typeof errorToResponse>[1];

const passthrough = async (
  _c: unknown,
  next: () => Promise<void>,
): Promise<void> => {
  await next();
};

/**
 * Builds an app shaped like apps/server/src/server.ts:
 * `outerExtra` pass-through `app.use("*")` levels, then cors, then compress
 * (all OUTSIDE/at compress), then `inner` pass-through levels registered
 * after compress (like the /api/v1/* slow-request logger), then the route.
 */
function buildApp(outerExtra: number, inner: number): Hono {
  const app = new Hono();
  for (let i = 0; i < outerExtra; i++) app.use("*", passthrough);
  app.use("*", cors({ origin: () => null }));
  app.use("*", compress());
  app.onError((error) => errorToResponse(error, logger));
  for (let i = 0; i < inner; i++) app.use("/bad-header", passthrough);
  app.get("/ok", (c) => c.json({ ok: true }));
  // A route that puts free text into a header dictionary — the only way a
  // non-Latin-1 char reaches the wire path described in #1621.
  app.get(
    "/bad-header",
    () =>
      new Response(JSON.stringify({ ok: true }), {
        headers: {
          "content-type": "application/json",
          "x-purpose": EM_DASH_TEXT,
        },
      }),
  );
  return app;
}

async function listen(
  app: Hono,
): Promise<{ baseUrl: string; close: () => Promise<void> }> {
  return new Promise((resolve) => {
    const server = serve(
      { fetch: app.fetch, port: 0, hostname: "127.0.0.1" },
      (info) => {
        resolve({
          baseUrl: `http://127.0.0.1:${info.port}`,
          close: () => new Promise((r) => server.close(() => r())),
        });
      },
    );
  });
}

let baseUrl = "";
let close: () => Promise<void>;

beforeAll(async () => {
  ({ baseUrl, close } = await listen(buildApp(0, 0)));
});

afterAll(async () => {
  await close();
});

function byteStringErrors() {
  return logged.filter((entry) =>
    entry.message.includes("Cannot convert argument to a ByteString"),
  );
}

describe("issue #1621: non-Latin-1 response header", () => {
  it("control: a normal JSON route works", async () => {
    const res = await fetch(`${baseUrl}/ok`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("a header dictionary with U+2014 crashes at set res and yields an unstructured 500", async () => {
    logged.length = 0;
    const res = await fetch(`${baseUrl}/bad-header`);
    const text = await res.text();

    // 1) The server logs the exact TypeError from the issue, more than once
    //    for a single request (one per enclosing middleware level).
    const errors = byteStringErrors();
    expect(errors.length).toBeGreaterThan(1);
    expect(errors[0]!.message).toMatch(
      /character at index \d+ has a value of 8212 which is greater than 255/,
    );
    // 2) At least one of them has the `get headers` <- `set res` frames from
    //    the issue's stack.
    expect(
      errors.some((entry) => /get headers[\s\S]*set res/.test(entry.stack)),
    ).toBe(true);
    // 3) What the client actually receives: Hono's top-level catch runs
    //    errorToResponse one final time outside compose, so the wire answer is
    //    the generic 500 JSON — the header text and the real cause are gone.
    console.log(
      JSON.stringify(
        {
          status: res.status,
          contentType: res.headers.get("content-type"),
          body: text,
          loggedCount: errors.length,
          messages: errors.map((entry) => entry.message),
          stacks: errors.map((entry) =>
            entry.stack.split("\n").slice(0, 5).join("\n"),
          ),
        },
        null,
        2,
      ),
    );
    expect(res.status).toBe(500);
    expect(JSON.parse(text)).toEqual({
      code: "internal_error",
      message: "Internal server error",
    });
  });

  // Log-line count rule: (levels at or outside compress) + 1. Inner levels
  // (registered after compress, e.g. the /api/v1/* slow-request logger) add
  // nothing, so "4 lines" does NOT imply a path outside /api/v1/*.
  it.each([
    // [outerExtra, inner, expectedLines, what it models]
    [0, 0, 3, "cors+compress (this test's baseline)"],
    [0, 2, 3, "cors+compress + 2 inner levels: inner levels add no lines"],
    [1, 1, 4, "desktop-v0.37.0: telemetry+cors+compress (+ inner slow logger) = 4 = reporter's count"],
    [2, 1, 5, "main 16ceb3a54: telemetry+event-loop+cors+compress (+ inner slow logger) = 5 = live tasks route"],
  ])(
    "outerExtra=%i inner=%i logs %i lines (%s)",
    async (outerExtra, inner, expectedLines) => {
      const srv = await listen(buildApp(outerExtra, inner));
      try {
        logged.length = 0;
        const res = await fetch(`${srv.baseUrl}/bad-header`);
        await res.text();
        expect(res.status).toBe(500);
        expect(byteStringErrors().length).toBe(expectedLines);
      } finally {
        await srv.close();
      }
    },
  );
});
