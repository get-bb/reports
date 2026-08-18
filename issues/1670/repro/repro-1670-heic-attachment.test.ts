// Repro for get-bb/bb#1670: HEIC images pasted into the composer are stored and
// served verbatim as image/heic. Chromium (web app + Electron desktop) has no
// HEIC decoder, so the <img> that the composer / timeline renders from
// GET /api/v1/projects/:id/attachments/content is broken.
//
// This test encodes the contract a fix needs: an uploaded image attachment
// classified as `localImage` must be served in a format Chromium can decode.
// It FAILS on main (16ceb3a54) because the served content-type is image/heic.
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { uploadedPromptAttachmentSchema } from "@bb/server-contract";
import { readJson } from "../helpers/json.js";
import { seedHostSession, seedProjectWithSource } from "../helpers/seed.js";
import { withTestHarness } from "../helpers/test-app.js";

// Formats Chromium's image decoder handles (see also the list in
// apps/app/src/components/secondary-panel/git-diff/useDiffFileContentsRequester.ts).
const CHROMIUM_DECODABLE_IMAGE_TYPES = new Set([
  "image/avif",
  "image/bmp",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/svg+xml",
  "image/webp",
  "image/x-icon",
  "image/vnd.microsoft.icon",
]);

const SAMPLE_HEIC =
  process.env.BB_1670_HEIC ?? "/tmp/bb-reports/issues/1670/repro/sample.heic";

describe("repro #1670: HEIC prompt attachment", () => {
  it("serves an uploaded HEIC localImage in a Chromium-decodable format", async () => {
    await withTestHarness(async (harness) => {
      const { host } = seedHostSession(harness.deps, { id: "host-1670" });
      const { project } = seedProjectWithSource(harness.deps, {
        hostId: host.id,
      });

      // Real HEIC (ISO BMFF, ftyp mif1/heic). Falls back to a minimal ftyp box
      // if the sample file is not present so the test still runs anywhere.
      const bytes = await readFile(SAMPLE_HEIC).catch(
        () =>
          new Uint8Array([
            0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x6d, 0x69, 0x66,
            0x31, 0x00, 0x00, 0x00, 0x00, 0x6d, 0x69, 0x66, 0x31, 0x68, 0x65,
            0x69, 0x63,
          ]),
      );

      const form = new FormData();
      form.set(
        "file",
        new File([bytes], "IMG_0001.heic", { type: "image/heic" }),
      );
      const uploadResponse = await harness.app.request(
        `/api/v1/projects/${project.id}/attachments`,
        { body: form, method: "POST" },
      );
      expect(uploadResponse.status).toBe(201);
      const uploaded = uploadedPromptAttachmentSchema.parse(
        await readJson(uploadResponse),
      );
      // The server classifies it as an image (so the UI renders it in <img>) ...
      expect(uploaded.type).toBe("localImage");

      const contentResponse = await harness.app.request(
        `/api/v1/projects/${project.id}/attachments/content?path=${encodeURIComponent(uploaded.path)}`,
      );
      expect(contentResponse.status).toBe(200);
      const contentType = contentResponse.headers.get("content-type") ?? "";

      // ... but serves bytes the renderer cannot decode. On main this is
      // "image/heic" -> assertion fails.
      expect(
        CHROMIUM_DECODABLE_IMAGE_TYPES.has(contentType.split(";")[0] ?? ""),
        `localImage attachment served as ${contentType}, which Chromium cannot decode`,
      ).toBe(true);
    });
  });
});
