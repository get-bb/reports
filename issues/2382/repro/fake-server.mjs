import http from "node:http";

const port = Number.parseInt(process.env.BB_SERVER_PORT ?? "", 10);
const mode = process.env.REPRO_MODE;

if (!Number.isInteger(port) || !mode) {
  throw new Error("Set BB_SERVER_PORT and REPRO_MODE.");
}

const server = http.createServer((request, response) => {
  process.stdout.write(`${request.method} ${request.url}\n`);

  if (
    mode === "dispatch-stall" &&
    request.method === "GET" &&
    request.url === "/api/v1/plugins/contributions"
  ) {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(
      JSON.stringify({
        cliCommands: [
          {
            pluginId: "tasks",
            name: "tasks",
            summary: "Test command",
            commands: [],
          },
        ],
      }),
    );
    return;
  }

  // Keep the socket open. The client receives no headers or response body.
});

server.listen(port, "127.0.0.1", () => {
  process.stdout.write(`ready ${port} ${mode}\n`);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
