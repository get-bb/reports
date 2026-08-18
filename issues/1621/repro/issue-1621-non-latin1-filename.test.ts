// Issue #1621 repro: an attachment whose sanitized file name contains a
// non-Latin-1 character (U+2014 EM DASH) makes the download route return a
// Response whose Content-Disposition header value cannot be a ByteString.
// EXPECTED to fail on main (16ceb3a54): the download rejects/500s instead of 200.
import { createFakePluginHost } from "@get-bb/plugin-sdk/testing";
import { describe, expect, it } from "vitest";
import { createTasksStore } from "../db";
import { registerAttachments } from ".";

const EM_DASH_NAME = "report — final.txt";

describe("issue #1621: non-Latin-1 attachment file name", () => {
  it("download route survives an em dash in the file name", async () => {
    const { bb, harness } = createFakePluginHost({ pluginId: "tasks" });
    const store = createTasksStore(bb.storage.database());
    const project = store.createProject({
      name: "A",
      prefix: "A",
      color: "blue",
    });
    const task = store.createTask({ projectId: project.id, title: "owner" });
    registerAttachments(bb, store);
    try {
      const query = new URLSearchParams({
        taskId: task.id,
        fileName: EM_DASH_NAME,
        mime: "text/plain",
      });
      const uploaded = await harness.fetchHttp(
        "POST",
        `/attachments/upload?${query}`,
        {
          body: new TextEncoder().encode("hello"),
          headers: { "content-type": "text/plain" },
        },
      );
      expect(uploaded.status).toBe(201);
      const { attachmentId } = (await uploaded.json()) as {
        attachmentId: string;
      };
      // sanitizeFileName keeps the em dash (it only strips control chars and a
      // few punctuation marks), so the raw name reaches Content-Disposition.
      expect(store.getAttachment(attachmentId)?.fileName).toBe(EM_DASH_NAME);

      let outcome:
        | { status: number; disposition: string | null }
        | { thrown: string };
      try {
        const res = await harness.fetchHttp(
          "GET",
          `/attachments/download?attachmentId=${attachmentId}`,
        );
        outcome = {
          status: res.status,
          disposition: res.headers.get("content-disposition"),
        };
      } catch (error) {
        outcome = {
          thrown: error instanceof Error ? error.message : String(error),
        };
      }
      console.log("issue-1621 download outcome:", JSON.stringify(outcome));
      // Desired behaviour (RFC 6266): ASCII fallback in filename=, UTF-8 in filename*.
      expect(outcome).toEqual({
        status: 200,
        disposition: `attachment; filename="report - final.txt"; filename*=UTF-8''report%20%E2%80%94%20final.txt`,
      });
    } finally {
      await harness.dispose();
    }
  });
});
