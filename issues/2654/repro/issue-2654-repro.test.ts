import { spawn } from "node:child_process";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";

interface CliResult {
  code: number | null;
  stderr: string;
}

function runCli(baseUrl: string): Promise<CliResult> {
  return new Promise((resolve) => {
    const child = spawn(
      process.execPath,
      ["apps/cli/dist/index.js", "tasks", "create", "--title", "probe"],
      {
        cwd: new URL("../../../..", import.meta.url),
        env: { ...process.env, BB_CLI: "", BB_SERVER_URL: baseUrl },
      },
    );
    let stderr = "";
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.on("close", (code) => resolve({ code, stderr }));
  });
}

describe("plugin CLI timeout command state", () => {
  let server: Server | undefined;

  afterEach(async () => {
    if (server !== undefined) {
      await new Promise<void>((resolve) => server?.close(() => resolve()));
    }
  });

  it("does not send the command request when contribution discovery times out", async () => {
    const requests: string[] = [];
    server = createServer((request) => {
      requests.push(`${request.method} ${request.url}`);
    });
    await new Promise<void>((resolve) =>
      server?.listen(0, "127.0.0.1", resolve),
    );
    const address = server.address() as AddressInfo;

    const result = await runCli(`http://127.0.0.1:${address.port}`);

    process.stdout.write(
      JSON.stringify({ ...result, requests }, null, 2) + "\n",
    );
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("No server response was received");
    expect(requests).toEqual([
      "GET /api/v1/plugins/contributions",
      "GET /api/v1/plugins/contributions",
      "GET /api/v1/plugins/contributions",
    ]);
  }, 20_000);
});
