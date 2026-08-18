// Repro for get-bb/bb#1558: waitForHealth() accepts a 200 from an UNRELATED
// server on the configured port and reports the managed server child healthy,
// even though that child never bound the port (it exits shortly after with
// EADDRINUSE). On main this test FAILS at the final assertion:
// waitForHealth resolves on the very first poll because the foreign server
// answers before the child has even finished booting.
//
// Requires `waitForHealth` to be exported from src/launcher.ts (a one-line
// `export` was added for this repro; see the report).
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { describe, expect, it } from "vitest";
import { waitForHealth } from "../src/launcher.js";

async function listen(handler: Parameters<typeof createServer>[1]) {
  const server = createServer(handler);
  await new Promise<void>((resolvePromise, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolvePromise);
  });
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("expected TCP address");
  }
  return {
    port: address.port,
    close: () =>
      new Promise<void>((resolvePromise, reject) => {
        server.close((error) => (error ? reject(error) : resolvePromise()));
      }),
  };
}

describe("issue #1558", () => {
  it("does not treat an unrelated server's /health as the managed child becoming healthy", async () => {
    // "Instance one": some other bb server already owning the port.
    let healthHits = 0;
    const foreign = await listen((request, response) => {
      if (request.url === "/health") healthHits += 1;
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ ok: true }));
    });

    // "Instance two's server child": boots for a moment, then dies the way
    // apps/server does on EADDRINUSE (non-zero exit, never listens).
    const child = spawn(
      process.execPath,
      ["-e", "setTimeout(() => process.exit(1), 400)"],
      { stdio: "ignore" },
    );

    try {
      const outcome = await waitForHealth({
        childProcess: child,
        url: `http://127.0.0.1:${foreign.port}/health`,
        timeoutMs: 5_000,
      }).then(
        () => "healthy" as const,
        (error: unknown) =>
          error instanceof Error ? error.message : String(error),
      );

      // Wait for the child to actually exit so the assertion below is about
      // what waitForHealth decided, not about timing.
      await new Promise<void>((resolvePromise) => {
        if (child.exitCode !== null) return resolvePromise();
        child.once("exit", () => resolvePromise());
      });

      expect(child.exitCode).toBe(1);
      expect(healthHits).toBeGreaterThan(0);
      // BUG (main): outcome === "healthy" — the foreign 200 satisfied the check
      // before the doomed child even exited.
      expect(outcome).not.toBe("healthy");
    } finally {
      if (child.exitCode === null) child.kill("SIGKILL");
      await foreign.close();
    }
  });
});
