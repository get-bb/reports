import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const checkout = resolve(process.argv[2]);
const requireDesktop = createRequire(join(checkout, "apps/desktop/package.json"));
const { build } = requireDesktop("esbuild");
const electron = requireDesktop("electron");
const artifactDirectory = dirname(fileURLToPath(import.meta.url));
const temporary = mkdtempSync(join(tmpdir(), "bb-7661-cookie-"));
const bundle = join(temporary, "production.cjs");
const environment = { ...process.env };
delete environment.ELECTRON_RUN_AS_NODE;

try {
  mkdirSync(join(temporary, "profile"));
  await build({
    stdin: {
      contents: [
        `export { BB_BROWSER_PARTITION } from ${JSON.stringify(join(checkout, "apps/desktop/src/desktop-browser-view.ts"))};`,
        `export { readChromiumCookieDatabase } from ${JSON.stringify(join(checkout, "apps/desktop/src/browser-import/chromium-cookies.ts"))};`,
        `export { writeCookies } from ${JSON.stringify(join(checkout, "apps/desktop/src/browser-import/browser-import.ts"))};`,
      ].join("\n"),
      resolveDir: checkout,
    },
    outfile: bundle,
    bundle: true,
    platform: "node",
    format: "cjs",
    conditions: ["source"],
    external: ["electron"],
    legalComments: "none",
  });
  for (const phase of ["seed", "verify"]) {
    const child = spawnSync(electron, [
      "--no-sandbox",
      "--ozone-platform=headless",
      "--disable-gpu",
      join(artifactDirectory, "restart.cjs"),
      phase,
      join(temporary, "profile"),
      bundle,
    ], { env: environment, encoding: "utf8", timeout: 30000 });
    process.stdout.write(child.stdout ?? "");
    process.stderr.write(child.stderr ?? "");
    console.log(`phase=${phase} exit=${child.status} signal=${child.signal}`);
    if (child.error) throw child.error;
    if (child.status !== 0) {
      process.exitCode = child.status ?? 2;
      break;
    }
  }
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
