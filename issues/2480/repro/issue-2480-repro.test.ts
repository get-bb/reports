import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { afterAll, beforeAll, expect, it } from "vitest";
import { waitForCompatibleServer } from "../src/server-probe.js";

let closeServer: (() => Promise<void>) | undefined;
let serverUrl = "";

function writeJson(response: ServerResponse, body: object): void {
  response.writeHead(200, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

beforeAll(async () => {
  let configRequests = 0;
  const server = createServer(
    (request: IncomingMessage, response: ServerResponse) => {
      if (request.url === "/health") {
        writeJson(response, { ok: true });
        return;
      }
      if (request.url === "/api/v1/system/config") {
        configRequests += 1;
        if (configRequests === 1) {
          setTimeout(() => {
            writeJson(response, {
              hostDaemonPort: 38887,
              voiceTranscriptionEnabled: false,
            });
          }, 75);
          return;
        }
        writeJson(response, {
          hostDaemonPort: 38887,
          voiceTranscriptionEnabled: false,
        });
        return;
      }
      response.writeHead(404);
      response.end();
    },
  );
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("The test server did not bind to a TCP port");
  }
  serverUrl = `http://127.0.0.1:${address.port}`;
  closeServer = () =>
    new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
});

afterAll(async () => {
  await closeServer?.();
});

it("retries a transient config abort while the new bb server starts", async () => {
  const result = await waitForCompatibleServer({
    intervalMs: 20,
    serverUrl,
    timeoutMs: 1_000,
  });

  expect(result).toEqual({
    dataDir: null,
    kind: "compatible",
    serverUrl,
  });
});
