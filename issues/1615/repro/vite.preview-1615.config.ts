import { defineConfig } from "vite";
import { sharedViteConfig } from "./vite.config.js";
export default defineConfig({
  ...sharedViteConfig,
  preview: {
    port: 18435,
    proxy: {
      "/api": { target: "http://localhost:26434", changeOrigin: true, xfwd: true },
      "/ws": { target: "http://localhost:26434", changeOrigin: true, ws: true, xfwd: true },
    },
  },
});
