import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { resolveBbAppRuntimeState } from "../src/launcher.js";

it("preserves the thread proxy destination when a managed server is configured", async () => {
  const dataDir = await mkdtemp(join(tmpdir(), "bb-routing-repro-"));
  const proxyUrl = "http://127.0.0.1:48761";
  const storedUrl = "https://saved-server.test";
  const resolve = () => resolveBbAppRuntimeState({
    entrypointUrl: new URL("../src/bin/bb.ts", import.meta.url).href,
    env: { BB_DATA_DIR: dataDir, BB_SERVER_URL: proxyUrl },
    homeDir: dataDir,
    options: { help: false },
    serverUrlMode: "managed",
  });
  try {
    const baseline = await resolve();
    expect(baseline.env.BB_SERVER_URL).toBe(proxyUrl);
    await writeFile(join(dataDir, "config.json"), JSON.stringify({ serverUrl: storedUrl }));
    const configured = await resolve();
    console.log(JSON.stringify({ baseline: baseline.env.BB_SERVER_URL, configured: configured.env.BB_SERVER_URL }));
    expect(configured.env.BB_SERVER_URL).toBe(proxyUrl);
  } finally {
    await rm(dataDir, { recursive: true, force: true });
  }
});
