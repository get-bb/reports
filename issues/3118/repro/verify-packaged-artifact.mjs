import { access, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const repoRoot = resolve(process.argv[2] ?? process.cwd());
const packageRoot = join(
  repoRoot,
  "apps/desktop/release/mac-arm64/bb.app/Contents/Resources/app.asar.unpacked/node_modules/bb-app",
);
const readmePath = join(packageRoot, "README.md");
const serverEntry = join(packageRoot, "server/dist/start-server.js");
const serviceModule = join(
  repoRoot,
  "apps/server/src/services/install/bb-app-artifact.ts",
);

let readmePresent = true;
try {
  await access(readmePath);
} catch {
  readmePresent = false;
}
console.log(`packaged_readme_present=${readmePresent}`);

const { createBbAppArtifactService } = await import(
  pathToFileURL(serviceModule).href
);
const dataDir = await mkdtemp(join(tmpdir(), "bb-artifact-repro-"));
const service = createBbAppArtifactService({
  dataDir,
  serverEntryUrl: pathToFileURL(serverEntry).href,
});
console.log(`version=${await service.getVersion()}`);

try {
  const artifact = await service.getArtifact();
  console.log(`artifact_created=${artifact.size > 0}`);
} catch (error) {
  const code =
    error !== null && typeof error === "object" && "code" in error
      ? error.code
      : "UNKNOWN";
  console.error(`artifact_created=false error_code=${code}`);
  process.exitCode = 1;
}
