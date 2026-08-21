// Repro for get-bb/bb#2072: a fresh `bb plugin new --app` scaffold cannot
// typecheck the documented `import { toast } from "sonner"` (nor most other
// BB-shimmed specifiers) even though `bb plugin build` bundles it fine.
//
// The test scaffolds a plugin, materialises node_modules the way `npm install`
// would (every package the scaffold's package.json declares, symlinked from
// this workspace so no network is needed), writes an app.tsx that imports a
// shimmed package, and runs tsc with the scaffold's own tsconfig.
import { readFileSync } from "node:fs";
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { promisify } from "node:util";
import { execFile } from "node:child_process";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { scaffoldPlugin } from "../src/plugin-scaffold.js";

const execFileAsync = promisify(execFile);
const repoRoot = resolve(process.cwd(), "../..");
const appRoot = join(repoRoot, "apps", "app");
const pluginSdkRoot = join(repoRoot, "packages", "plugin-sdk");
const requireFromApp = createRequire(join(appRoot, "package.json"));
const requireFromRoot = createRequire(join(repoRoot, "package.json"));
const requireFromSdk = createRequire(join(pluginSdkRoot, "package.json"));

/**
 * Mirror of RUNTIME_SLOT_BY_SPECIFIER in
 * packages/plugin-build/src/build-plugin-app.ts, minus the SDK's own
 * specifiers and the shared-ui icon module. Every one of these is documented
 * as "import freely, never bundled" in the bb-plugin-authoring skill.
 */
const SHIMMED_SPECIFIERS = [
  "react",
  "react-dom",
  "react-dom/client",
  "react/jsx-runtime",
  "@pierre/diffs",
  "@pierre/diffs/react",
  "@radix-ui/react-alert-dialog",
  "@radix-ui/react-context-menu",
  "@radix-ui/react-dialog",
  "@radix-ui/react-dropdown-menu",
  "@radix-ui/react-hover-card",
  "@radix-ui/react-menubar",
  "@radix-ui/react-navigation-menu",
  "@radix-ui/react-popover",
  "@radix-ui/react-select",
  "@radix-ui/react-tooltip",
  "sonner",
  "vaul",
  "clsx",
  "tailwind-merge",
  "class-variance-authority",
] as const;

function packageRoot(name: string): string {
  // pnpm lays each dependency out as node_modules/<name> (a symlink into the
  // store); prefer that over require.resolve, which ESM-only packages with a
  // strict exports map (e.g. @pierre/diffs) refuse.
  for (const base of [appRoot, repoRoot, pluginSdkRoot]) {
    const candidate = join(base, "node_modules", name);
    try {
      readFileSync(join(candidate, "package.json"), "utf8");
      return candidate;
    } catch {
      // not here
    }
  }
  for (const req of [requireFromApp, requireFromRoot, requireFromSdk]) {
    try {
      return dirname(req.resolve(`${name}/package.json`));
    } catch {
      // package.json may not be exported; walk up from the entry instead.
      try {
        let current = dirname(req.resolve(name));
        while (true) {
          try {
            const manifest = JSON.parse(
              readFileSync(join(current, "package.json"), "utf8"),
            ) as { name?: string };
            if (manifest.name === name) return current;
          } catch {
            // keep walking
          }
          const parent = dirname(current);
          if (parent === current) break;
          current = parent;
        }
      } catch {
        // try the next resolver
      }
    }
  }
  throw new Error(`package root not found in workspace: ${name}`);
}

/**
 * What `npm install --include=dev` leaves on disk for the scaffold: exactly the
 * packages its package.json declares, nothing more. @get-bb/plugin-sdk links
 * to the workspace package (turbo's build:types has filled bundled-types/).
 */
async function installDeclaredDependencies(targetDir: string): Promise<void> {
  const manifest = JSON.parse(
    await readFile(join(targetDir, "package.json"), "utf8"),
  ) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  const names = new Set([
    ...Object.keys(manifest.dependencies ?? {}),
    ...Object.keys(manifest.devDependencies ?? {}),
  ]);
  for (const name of names) {
    const target = join(targetDir, "node_modules", name);
    await mkdir(dirname(target), { recursive: true });
    const source =
      name === "@get-bb/plugin-sdk" ? pluginSdkRoot : packageRoot(name);
    await symlink(source, target, "dir");
  }
}

async function runTsc(
  targetDir: string,
): Promise<{ ok: boolean; output: string }> {
  const typescriptRoot = packageRoot("typescript");
  try {
    const { stdout, stderr } = await execFileAsync(
      process.execPath,
      [join(typescriptRoot, "lib", "tsc.js"), "--project", "tsconfig.json"],
      { cwd: targetDir },
    );
    return { ok: true, output: `${stdout}${stderr}` };
  } catch (error) {
    const failed = error as { stderr?: string; stdout?: string };
    return { ok: false, output: `${failed.stdout ?? ""}${failed.stderr ?? ""}` };
  }
}

describe("scaffold typechecks documented shimmed imports (#2072)", () => {
  let workDir: string;
  let targetDir: string;

  beforeEach(async () => {
    workDir = await mkdtemp(join(tmpdir(), "bb-scaffold-shims-"));
    targetDir = join(workDir, "bb-plugin-toasty");
    await scaffoldPlugin({
      targetDir,
      packageName: "bb-plugin-toasty",
      bbVersion: "0.39.0",
      app: true,
    });
    await installDeclaredDependencies(targetDir);
  });

  afterEach(async () => {
    await rm(workDir, { recursive: true, force: true });
  });

  it("the untouched scaffold typechecks (control)", async () => {
    const result = await runTsc(targetDir);
    expect(result.output, result.output).toBe("");
    expect(result.ok).toBe(true);
  }, 120_000);

  it('`import { toast } from "sonner"` typechecks out of the box', async () => {
    const appPath = join(targetDir, "app.tsx");
    const app = await readFile(appPath, "utf8");
    await writeFile(
      appPath,
      app.replace(
        'import { useState } from "react";',
        'import { useState } from "react";\nimport { toast } from "sonner";\ntoast.success("hi");',
      ),
    );
    const result = await runTsc(targetDir);
    // On main this fails with:
    //   app.tsx(13,23): error TS2307: Cannot find module 'sonner' or its
    //   corresponding type declarations.
    expect(result.output, result.output).not.toContain("TS2307");
    expect(result.ok).toBe(true);
  }, 120_000);

  it("every runtime-shimmed specifier typechecks out of the box", async () => {
    const lines = SHIMMED_SPECIFIERS.map(
      (specifier, i) => `import * as m${i} from "${specifier}";`,
    );
    lines.push(
      `export const all = [${SHIMMED_SPECIFIERS.map((_, i) => `m${i}`).join(", ")}];`,
    );
    await writeFile(
      join(targetDir, "components", "all-shims.ts"),
      `${lines.join("\n")}\n`,
    );
    const result = await runTsc(targetDir);
    const missing = [
      ...result.output.matchAll(/Cannot find module '([^']+)'/g),
    ].map((m) => m[1]);
    // On main: 13 of the 21 specifiers are unresolvable (all but react*,
    // @radix-ui/react-dialog, clsx, tailwind-merge, class-variance-authority).
    expect(missing, result.output).toEqual([]);
    expect(result.ok).toBe(true);
  }, 120_000);
});
