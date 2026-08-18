import { defineConfig } from "vite";
import { sharedViteConfig } from "./vite.config.js";
export default defineConfig({
  ...sharedViteConfig,
  preview: {
    port: 17793,
    proxy: {
      "/api": { target: "http://localhost:25792", changeOrigin: true, xfwd: true },
      "/ws": { target: "http://localhost:25792", changeOrigin: true, ws: true, xfwd: true },
    },
  },
});
