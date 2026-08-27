import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createTestAppHarness,
  type TestAppHarness,
} from "../../helpers/test-app.js";

const BASE = "http://127.0.0.1:3334";

const LEGACY_OPENER_SOURCE = `
  import { defineRpcContract } from "@get-bb/plugin-sdk";
  import { z } from "zod";

  const sourceSchema = z
    .object({
      kind: z.enum(["workspace", "host", "thread-storage"]),
      threadId: z.string().nullable(),
      environmentId: z.string().nullable(),
      projectId: z.string().nullable(),
    })
    .strict();

  const rpcContract = defineRpcContract({
    read: {
      input: z.object({ path: z.string().min(1), source: sourceSchema }).strict(),
      output: z.object({ kind: z.literal("text"), content: z.string() }),
    },
  });

  export default function plugin(bb: any) {
    bb.rpc.register(rpcContract, {
      read: async () => ({ kind: "text", content: "opened" }),
    });
  }
`;

describe("legacy file opener with a project-routed source", () => {
  let harness: TestAppHarness;

  beforeEach(async () => {
    harness = await createTestAppHarness({ devAppPort: 5173 });
    const rootDir = join(harness.config.dataDir, "legacy-opener");
    await mkdir(rootDir, { recursive: true });
    await writeFile(
      join(rootDir, "package.json"),
      JSON.stringify({
        name: "bb-plugin-legacy-opener",
        version: "0.1.0",
        bb: {
          name: "Legacy opener",
          description: "Strict contract from before experimental_hostId.",
          branding: { icon: "File" },
          server: "./server.ts",
        },
      }),
    );
    await writeFile(join(rootDir, "server.ts"), LEGACY_OPENER_SOURCE);
    const entry = await harness.pluginService.installPath(rootDir);
    expect(entry.status).toBe("running");
  });

  afterEach(async () => {
    await harness.pluginService.stop();
    await harness.cleanup();
  });

  it("opens a workspace file from a draft thread on its project host", async () => {
    const response = await harness.app.request(
      `${BASE}/api/v1/plugins/legacy-opener/rpc/read`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          path: "package.json",
          source: {
            kind: "workspace",
            threadId: null,
            environmentId: null,
            projectId: "proj_qa",
            experimental_hostId: "host_qa",
          },
        }),
      },
    );

    expect({ status: response.status, body: await response.json() }).toEqual({
      status: 200,
      body: { ok: true, result: { kind: "text", content: "opened" } },
    });
  });
});
