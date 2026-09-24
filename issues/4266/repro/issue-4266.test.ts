import { expect, it, vi } from "vitest";
import { createServerClient, type FetchFn } from "./server-client.js";

it.each([
  "https://attachment-service.test",
  "http://127.0.0.1:49831",
  "http://attachment-service.test:49832",
])("downloads attachment after opening session via %s", async (serverUrl) => {
  const fetchFn = vi.fn<FetchFn>(async (input) => {
    const url = new URL(String(input));
    if (url.pathname === "/internal/session/open") {
      return Response.json({
        sessionId: "test-session",
        machineEnvironment: { revision: 0, entries: [] },
        heartbeatIntervalMs: 5000,
        leaseTimeoutMs: 30000,
      }, { status: 201 });
    }
    return new Response("image-bytes", { status: 200 });
  });
  const client = createServerClient({
    serverUrl,
    hostKey: "synthetic-test-key",
    getSessionId: () => "test-session",
    fetchFn,
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  });
  await expect(client.openSession({
    hostId: "test-host",
    hostName: "test",
    instanceId: "test-instance",
    dataDir: "/tmp/unused-4266",
    localApiPort: null,
    activeThreads: [],
    loadedEnvironments: [],
  })).resolves.toMatchObject({ sessionId: "test-session" });
  expect(fetchFn).toHaveBeenCalledTimes(1);
  const result = client.fetchProjectAttachment({
    projectId: "test-project",
    threadId: "test-thread",
    path: "fixture.png",
    maxBytes: 100,
    expectedSizeBytes: 11,
  });
  await expect(result).resolves.toMatchObject({
    bytes: new TextEncoder().encode("image-bytes"),
  });
  expect(fetchFn).toHaveBeenCalledTimes(2);
});
