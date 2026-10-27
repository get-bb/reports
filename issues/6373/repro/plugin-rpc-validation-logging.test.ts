import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it, vi } from "vitest";
import { defineRpcContract } from "@get-bb/plugin-sdk";
import { z } from "zod";
import { createTestAppHarness } from "../../helpers/test-app.js";

it.each(["input", "output"] as const)(
  "logs RPC %s validation paths without payloads or custom issue messages",
  async (phase) => {
    const harness = await createTestAppHarness();
    const rootDir = await mkdtemp(join(tmpdir(), "bb-rpc-diagnostics-"));
    const warn = vi.spyOn(harness.deps.logger, "warn");
    try {
      await writeFile(
        join(rootDir, "package.json"),
        JSON.stringify({
          name: "bb-plugin-rpc-diagnostics",
          version: "0.1.0",
          bb: {
            name: "RPC diagnostics fixture",
            description: "Validation logging fixture",
            branding: { icon: "Zap" },
            server: "./server.ts",
          },
        }),
      );
      await writeFile(
        join(rootDir, "server.ts"),
        "export default function plugin() {}",
      );
      expect((await harness.pluginService.installPath(rootDir)).status).toBe(
        "running",
      );
      const api = harness.pluginService.getApi("rpc-diagnostics");
      if (!api) throw new Error("fixture plugin did not start");
      const schema = z.object({
        entries: z.array(
          z.object({ count: z.number({ error: "private-validator-detail" }) }),
        ),
      });
      const invalid = { entries: [{ count: "private-payload-content" }] };
      const handler = vi.fn(() => (phase === "output" ? invalid : null));
      api.rpc.register(
        defineRpcContract({
          inspect: {
            input: phase === "input" ? schema : z.null(),
            output: phase === "output" ? schema : z.null(),
          },
        }),
        { inspect: handler },
      );
      const response = await harness.app.request(
        "/api/v1/plugins/rpc-diagnostics/rpc/inspect",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(phase === "input" ? invalid : null),
        },
      );
      const body = await response.json();
      expect(response.status).toBe(phase === "input" ? 400 : 500);
      expect(body).toMatchObject({
        ok: false,
        error: {
          code: `invalid_${phase}`,
          message: `rpc ${phase} validation failed`,
          issues: [
            {
              path: ["entries", 0, "count"],
              message: "private-validator-detail",
            },
          ],
        },
      });
      expect(handler).toHaveBeenCalledTimes(phase === "input" ? 0 : 1);
      const warning = warn.mock.calls
        .map(([message]) => String(message))
        .find((message) => message.includes("rpc inspect failed:"));
      console.log(JSON.stringify({ phase, response: body, warning }));
      expect(warning).toBeDefined();
      expect(warning).not.toContain("private-payload-content");
      expect(warning).not.toContain("private-validator-detail");
      expect(warning).toContain('["entries",0,"count"]');
    } finally {
      warn.mockRestore();
      await harness.pluginService.stop();
      await harness.cleanup();
      await rm(rootDir, { recursive: true, force: true });
    }
  },
);
