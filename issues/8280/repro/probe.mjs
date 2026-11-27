import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { platform, release, arch } from "node:os";

const checkout = resolve(process.argv[2] ?? ".");
const desktop = join(checkout, "apps/desktop");
const packageData = JSON.parse(readFileSync(join(desktop, "package.json"), "utf8"));
const sourceFiles = [];
function collect(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) collect(entryPath);
    else if (/\.[cm]?[jt]sx?$/.test(entry.name)) sourceFiles.push(entryPath);
  }
}
collect(join(desktop, "src"));
const matches = [];
for (const sourceFile of sourceFiles.sort()) {
  const lines = readFileSync(sourceFile, "utf8").split("\n");
  lines.forEach((line, index) => {
    if (/appendSwitch|disableHardwareAcceleration/.test(line)) {
      matches.push({ path: relative(checkout, sourceFile), line: index + 1, text: line.trim() });
    }
  });
}
const main = readFileSync(join(desktop, "src/main.ts"), "utf8");
const theme = readFileSync(join(checkout, "apps/app/src/components/ui/theme.css"), "utf8");
const containment = readFileSync(join(checkout, "apps/app/src/components/thread/timeline/timeline-row-containment.ts"), "utf8");
const result = {
  commit: execFileSync("git", ["-C", checkout, "rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  trackedTreeClean: execFileSync("git", ["-C", checkout, "status", "--porcelain", "--untracked-files=no"], { encoding: "utf8" }).trim() === "",
  environment: { platform: platform(), release: release(), arch: arch(), node: process.version },
  electronDeclared: packageData.devDependencies.electron,
  sourceFilesScanned: sourceFiles.length,
  chromiumSwitchOrHardwareAccelerationCalls: matches,
  mainConstructsBrowserWindow: main.includes("return new BrowserWindow(options)"),
  mainWaitsForReady: main.includes("await app.whenReady()"),
  shimmerRequestsLayer: /will-change:\s*transform/.test(theme),
  timelineContainmentMobileOnly: containment.includes('"max-md:[content-visibility:auto]"'),
  displayAvailable: Boolean(process.env.DISPLAY || process.env.WAYLAND_DISPLAY),
  linuxGpuDeviceAvailable: existsSync("/dev/dri"),
  macOSMetalAvailable: platform() === "darwin",
  visualReproduction: "NOT ATTEMPTED: this host has no macOS/Metal display pipeline; source observations are not a rendering reproduction",
};
console.log(JSON.stringify(result, null, 2));
