import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const checkout = resolve(process.argv[2] ?? ".");
const bridgeUrl = pathToFileURL(
  resolve(checkout, "packages/provider-bridge-acp/src/bridge/bridge.ts"),
).href;
const scenarios = [
  ["successful listing", "process.stdout.write('alpha - Alpha\\nbeta - Beta\\ngamma - Gamma\\n')"],
  ["unsuccessful listing in a fresh bridge", "process.exit(2)"],
];

for (const [name, script] of scenarios) {
  const request = {
    jsonrpc: "2.0",
    id: 1,
    method: "model/list",
    params: {
      providerOptions: {
        acpLaunchSpec: {
          displayName: "Catalog Reproduction",
          command: process.execPath,
          args: ["-e", script],
          env: {},
          modelCli: { listArgs: ["-e", script], primaryModels: [] },
        },
      },
    },
  };
  const worker = `import { handleLine } from ${JSON.stringify(bridgeUrl)}; handleLine(${JSON.stringify(JSON.stringify(request))});`;
  const result = spawnSync(
    process.execPath,
    ["--conditions=source", "--import", "tsx", "--input-type=module", "-e", worker],
    { cwd: checkout, encoding: "utf8", timeout: 45_000 },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr);
  console.log(name);
  console.log(result.stdout.trim());
}
