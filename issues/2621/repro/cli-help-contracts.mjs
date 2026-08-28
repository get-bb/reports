import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { strict as assert } from "node:assert";

const cliEntry = process.argv[2];
assert(cliEntry, "Pass the built CLI entry path.");

let pluginCalls = 0;
const server = createServer((request, response) => {
  response.setHeader("content-type", "application/json");
  if (
    request.method === "GET" &&
    request.url === "/api/v1/plugins/contributions"
  ) {
    response.end(
      JSON.stringify({
        cliCommands: [
          {
            pluginId: "fixture-plugin",
            name: "fixture",
            summary: "Fixture command",
            commands: [
              {
                name: "update",
                summary: "Update a fixture",
                usage: "bb fixture update <id> [options]",
              },
            ],
          },
        ],
      }),
    );
    return;
  }
  if (
    request.method === "POST" &&
    request.url === "/api/v1/plugins/fixture-plugin/cli"
  ) {
    pluginCalls += 1;
    response.end(
      JSON.stringify({
        exitCode: 7,
        stderr: "fixture validation ran",
      }),
    );
    return;
  }
  response.statusCode = 404;
  response.end(JSON.stringify({ error: "not found" }));
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
assert(address && typeof address === "object");
const serverUrl = `http://127.0.0.1:${address.port}`;

function runCli(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cliEntry, ...args], {
      env: {
        ...process.env,
        BB_CLI_REEXEC: "1",
        BB_SERVER_URL: serverUrl,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (status) => resolve({ status, stdout, stderr }));
  });
}

const nested = await runCli(["fixture", "update", "--help"]);
const core = await runCli(["thread", "search", "--help"]);
await new Promise((resolve) => server.close(resolve));

console.log(
  JSON.stringify(
    {
      nested,
      pluginCalls,
      core,
    },
    null,
    2,
  ),
);

assert.equal(nested.status, 0, "nested plugin help must exit successfully");
assert.match(nested.stdout, /bb fixture update <id> \[options\]/u);
assert.equal(pluginCalls, 0, "help must not run plugin validation");
assert.match(
  core.stdout,
  /--limit <count>\s+Maximum results per group \(1-50\)/u,
  "core help must show the enforced range",
);
