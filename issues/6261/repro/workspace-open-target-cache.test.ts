import { writeFile } from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createHostDaemonLocalClient } from "@bb/host-daemon-contract";
import {
  listWorkspaceOpenTargetsWithRuntime,
  type WorkspaceOpenTargetRuntime,
} from "@bb/local-open-targets";
import { startLocalApiServer, type LocalApiServer } from "./local-api.js";

describe("workspace open-target discovery cache", () => {
  let server: LocalApiServer | null = null;

  afterEach(async () => {
    await server?.close();
    server = null;
    vi.restoreAllMocks();
  });

  it("reuses macOS discovery and extracted icons across identical HTTP requests", async () => {
    const commands: Record<string, number> = {};
    const runtime: WorkspaceOpenTargetRuntime = {
      platform: "darwin",
      applicationDirectories: [],
      execFile: async (file, args) => {
        commands[file] = (commands[file] ?? 0) + 1;
        if (file === "mdfind") {
          return {
            stdout: args.join(" ").includes("com.microsoft.VSCode")
              ? "/test/Code.app\n"
              : "",
          };
        }
        if (file === "plutil") {
          return { stdout: "Code.icns" };
        }
        if (file === "qlmanage") {
          await writeFile(
            path.join(args[4]!, "Code.icns.png"),
            Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/2ioAAAAASUVORK5CYII=", "base64"),
          );
        }
        return { stdout: "" };
      },
    };
    const discover = vi.fn(() => listWorkspaceOpenTargetsWithRuntime(runtime));
    server = await startLocalApiServer({
      hostId: "cache-test",
      localApiConfig: {
        bindHost: "localhost",
        healthPath: "/health",
        healthValue: "ok",
        port: 0,
      },
      serverUrl: "http://server.test",
      serverPort: 0,
      getConnected: () => true,
      listWorkspaceOpenTargets: discover,
    });
    const client = createHostDaemonLocalClient(`http://localhost:${server.port}`);
    const first = await client["workspace-open-targets"].$get({ query: {} });
    const firstBody = await first.json();
    const firstCommands = { ...commands };
    expect(first.status).toBe(200);
    expect(firstBody.targets).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "vscode", icon: expect.objectContaining({ kind: "data-url" }) }),
    ]));
    expect(firstCommands.mdfind).toBeGreaterThan(0);
    expect(firstCommands.plutil).toBeGreaterThan(0);
    expect(firstCommands.qlmanage).toBeGreaterThan(0);
    for (let request = 0; request < 2; request += 1) {
      const response = await client["workspace-open-targets"].$get({ query: {} });
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual(firstBody);
    }
    console.log(JSON.stringify({ firstCommands, totalCommands: commands, discoveryRuns: discover.mock.calls.length }));
    expect(commands).toEqual(firstCommands);
    expect(discover).toHaveBeenCalledTimes(1);
  });
});
