import {defineConfig} from 'vite';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';
export default defineConfig({plugins:[tailwindcss()],resolve:{conditions:['source'],alias:{'@':path.resolve(import.meta.dirname,'src')}},esbuild:{jsx:'automatic'},server:{host:'127.0.0.1',strictPort:true}});
