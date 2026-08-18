// Feasibility check for the "attribute via AsyncLocalStorage" direction.
import { AsyncLocalStorage } from "node:async_hooks";
import { EventEmitter } from "node:events";

const als = new AsyncLocalStorage();
const mode = process.argv[2] ?? "emitter";

process.on("uncaughtExceptionMonitor", (err) => {
  console.log(`[monitor] ${mode}: error=${err.message} pluginId=${als.getStore()?.pluginId ?? "<none>"}`);
});
process.on("unhandledRejection", (err) => {
  console.log(`[unhandledRejection] ${mode}: error=${err?.message} pluginId=${als.getStore()?.pluginId ?? "<none>"}`);
  process.exit(0);
});

als.run({ pluginId: "crashy-service" }, () => {
  if (mode === "emitter") {
    const client = new EventEmitter();
    setTimeout(() => client.emit("error", new Error("Socket timeout")), 20);
  } else if (mode === "timer-throw") {
    setTimeout(() => { throw new Error("timer throw"); }, 20);
  } else if (mode === "rejection") {
    setTimeout(() => { void Promise.reject(new Error("detached rejection")); }, 20);
  }
});
