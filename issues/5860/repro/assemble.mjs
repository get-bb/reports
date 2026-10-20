import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const outputDirectory = mkdtempSync(join(tmpdir(), "sidebar-footer-repro-"));
const bundlePath = join(outputDirectory, "fixture.js");
const build = spawnSync("pnpm", [
  "exec", "esbuild", "apps/app/issue-5860.tsx", "--bundle", "--format=iife",
  "--platform=browser", "--conditions=source", `--alias:@=${resolve("apps/app/src")}`,
  "--loader:.css=empty", '--define:process.env.NODE_ENV="production"',
  "--minify", `--outfile=${bundlePath}`,
], { stdio: "inherit" });
if (build.status !== 0) process.exit(build.status ?? 1);
const assetDirectory = resolve("apps/app/dist/assets");
const stylesheet = readdirSync(assetDirectory)
  .filter((name) => name.endsWith(".css"))
  .map((name) => readFileSync(join(assetDirectory, name), "utf8"))
  .join("\n");
const script = readFileSync(bundlePath, "utf8").replaceAll("</script>", "<\\/script>");
const outputPath = join(outputDirectory, "fixture.html");
writeFileSync(outputPath, `<!doctype html><html lang="en"><meta charset="utf-8"><title>Sidebar footer regression fixture</title><style>${stylesheet}</style><body><div id="root"></div><script>${script}</script></body></html>`);
console.log(outputPath);
