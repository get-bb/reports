import { build } from 'esbuild';
import path from 'node:path';
await build({entryPoints:['apps/app/.repro3759/main.tsx'],bundle:true,outfile:'apps/app/.repro3759/bundle.js',format:'esm',jsx:'automatic',alias:{'@':path.resolve('apps/app/src')},conditions:['source'],define:{'process.env.NODE_ENV':'"development"'}});
