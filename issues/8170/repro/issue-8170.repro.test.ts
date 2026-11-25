import { setImmediate } from "node:timers/promises";
import { describe, expect, it } from "vitest";
import type { BbPluginApi } from "@get-bb/plugin-sdk";
import {
  createFakePluginHost,
  makeThreadResponse,
} from "@get-bb/plugin-sdk/testing";
import { createMigratedConnection } from "../../../packages/db/src/testing.js";
import {
  getPluginKvValue,
  setPluginKvValue,
} from "../../../packages/db/src/data/plugin-storage.js";
import { registerAsyncQuestions } from "./async-questions.js";

describe("issue 8170: SQLite cursor write amplification", () => {
  it.each([undefined, 37])(
    "does not mutate SQLite on three empty notifications (stored cursor %s)",
    async (initialCursor) => {
      const database = createMigratedConnection();
      const pluginId = "provider-codex";
      const threadId = "thr_cursor_reproduction";
      const key = `async-question-cursor:${threadId}`;
      const host = createFakePluginHost({ pluginId });
      Object.assign(host.bb.storage.kv, {
        async get(storageKey: string) {
          const raw = getPluginKvValue(database, pluginId, storageKey);
          return raw === undefined ? undefined : JSON.parse(raw);
        },
        async set(storageKey: string, value: unknown) {
          const encoded = JSON.stringify(value);
          if (encoded === undefined) throw new Error("Invalid cursor value");
          setPluginKvValue(database, pluginId, storageKey, encoded);
        },
      });
      if (initialCursor !== undefined) {
        setPluginKvValue(database, pluginId, key, String(initialCursor));
      }
      host.harness.sdk.stub("threads.events.list", async () => []);
      registerAsyncQuestions(host.bb as unknown as BbPluginApi);
      try {
        const before = database.$client
          .prepare("SELECT total_changes() AS changes")
          .get();
        for (const sequence of [100, 101, 102]) {
          await host.harness.emitThreadEvent("experimental_thread.events", {
            thread: makeThreadResponse({ id: threadId, providerId: "codex" }),
            sequence,
          });
          await setImmediate();
        }
        expect(host.harness.sdk.callsTo("threads.events.list")).toHaveLength(3);
        const after = database.$client
          .prepare("SELECT total_changes() AS changes")
          .get();
        console.info(
          JSON.stringify({
            initialCursor: initialCursor ?? null,
            before,
            after,
          }),
        );
        expect(after).toEqual(before);
      } finally {
        database.$client.close();
      }
    },
  );
});
