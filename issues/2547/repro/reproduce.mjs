import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pathToFileURL } from "node:url";

const artifactDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(process.argv[2] ?? process.cwd());
const sourcePath = join(artifactDir, "documented-example.ts");
const typescriptUrl = pathToFileURL(
  join(repoRoot, "node_modules", "typescript", "lib", "typescript.js"),
);
const imported = await import(typescriptUrl.href);
const ts = imported.default;

const program = ts.createProgram({
  rootNames: [sourcePath],
  options: {
    strict: true,
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    noEmit: true,
    skipLibCheck: true,
    types: [],
    paths: {
      "@get-bb/plugin-sdk": [
        join(
          repoRoot,
          "packages",
          "plugin-sdk",
          "bundled-types",
          "bb-plugin-sdk.d.ts",
        ),
      ],
    },
  },
});

const diagnostics = ts.getPreEmitDiagnostics(program);
if (diagnostics.length > 0) {
  process.stdout.write(
    ts.formatDiagnosticsWithColorAndContext(diagnostics, {
      getCanonicalFileName: (fileName) => fileName,
      getCurrentDirectory: () => process.cwd(),
      getNewLine: () => "\n",
    }),
  );
  process.exitCode = 1;
}
