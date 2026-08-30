import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = resolve(process.argv[2] ?? ".");
const read = (path) => readFileSync(resolve(repoRoot, path), "utf8");

const guide = read("docs/provider-bridge-protocol.md");
const sdk = read("packages/plugin-sdk/src/provider-bridge.ts");
const sanitizer = read("packages/process-utils/src/index.ts");
const runtime = read("packages/agent-runtime/src/runtime-provider-process.ts");
const childBuilder = read(
  "packages/provider-bridge-protocol/src/bridge-kit/bridge-runtime-env.ts",
);

const sourceRequirements = [
  [sanitizer, 'key === "NODE_ENV" || key.startsWith("BB_")'],
  [sanitizer, "sanitizedEnv[key] = value"],
  [sanitizer, "sanitizedEnv.PATH = args.shellPath"],
  [runtime, "...sanitizeInheritedChildProcessEnv({ env: process.env })"],
  [runtime, "...this.args.env"],
  [runtime, "...processConfig.env"],
  [childBuilder, "delete childEnv.ELECTRON_RUN_AS_NODE"],
  [childBuilder, "delete childEnv[PROVIDER_BRIDGE_RECORD_DIR_ENV]"],
];

for (const [source, text] of sourceRequirements) {
  if (!source.includes(text)) {
    throw new Error(`The trusted source no longer contains: ${text}`);
  }
}

const failures = [];
if (/constructed by the runtime from an\s+allowlist/u.test(guide)) {
  failures.push("The child-process guide claims a runtime allowlist.");
}
if (/BB_\*` allowlist/u.test(guide)) {
  failures.push("The record-mode guide claims a BB_* allowlist.");
}
if (/one allowlist function/u.test(sdk)) {
  failures.push("The Plugin SDK declaration claims an allowlist.");
}

for (const name of [
  "NODE_ENV",
  "BB_*",
  "PATH",
  "env.passthrough",
  "ELECTRON_RUN_AS_NODE",
  "BB_PROVIDER_BRIDGE_RECORD_DIR",
]) {
  if (!guide.includes(name)) {
    failures.push(`The child-process guide does not describe ${name}.`);
  }
}

if (failures.length > 0) {
  console.error(`FAIL: ${failures.length} documentation mismatch(es)`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("PASS: The environment documentation matches the shipped filters.");
