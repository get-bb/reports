import { build } from './node_modules/.pnpm/esbuild@0.28.1/node_modules/esbuild/lib/main.js';
import path from 'node:path';
await build({entryPoints:['apps/app/issue-3334-harness/main.tsx'],bundle:true,outfile:'apps/app/issue-3334-harness/bundle.js',jsx:'automatic',nodePaths:[path.resolve('node_modules/.pnpm/node_modules')],plugins:[{name:'omit-css',setup(b){b.onLoad({filter:/\.css$/},()=>({contents:'',loader:'css'}));}}]});
