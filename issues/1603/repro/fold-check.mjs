// Bundle fold-in.js with the repo's rolldown (the bundler under Vite 8) with and
// without minification to see whether the try/catch RegExp feature detection is
// constant-folded away. Usage: node fold-check.mjs <bb repo root>
import { resolve } from "node:path";
const [repo] = process.argv.slice(2);
const { rolldown } = await import(
  resolve(repo, "node_modules/.pnpm/rolldown@1.0.0/node_modules/rolldown/dist/index.mjs")
);
const input = new URL("./fold-in.js", import.meta.url).pathname;
for (const minify of [false, true]) {
  const b = await rolldown({ input });
  const { output } = await b.generate({ format: "es", minify });
  console.log(`--- rolldown minify=${minify}:\n${output[0].code}`);
}
