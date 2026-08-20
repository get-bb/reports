// Repro for get-bb/bb#1985: PDF previews fall through to `unsupported`.
// Run: cd packages/client-core && pnpm exec vitest run test/file-preview-pdf-repro.test.ts
import { describe, expect, it } from "vitest";
import { buildFilePreview } from "../src/file-preview.js";

// Header + a binary (deflate) stream with bytes that are not valid UTF-8,
// which is what every real-world PDF looks like.
const BINARY_PDF_BYTES = Uint8Array.from([
  ...new TextEncoder().encode("%PDF-1.7\n%"),
  0xe2, 0xe3, 0xcf, 0xd3, // the conventional binary-marker comment bytes
  ...new TextEncoder().encode(
    "\n1 0 obj\n<< /Length 8 /Filter /FlateDecode >>\nstream\n",
  ),
  0x78, 0x9c, 0x00, 0xff, 0xfe, 0x01, 0x00, 0x80,
  ...new TextEncoder().encode("\nendstream\nendobj\n%%EOF\n"),
]);

describe("#1985 PDF file preview", () => {
  it("a real (binary) PDF served as application/pdf should get a renderable preview kind", () => {
    const preview = buildFilePreview({
      contentBytes: BINARY_PDF_BYTES,
      mimeType: "application/pdf",
      name: "handbook.pdf",
      path: "docs/handbook.pdf",
      url: "/api/v1/threads/t1/host-files/content?path=docs/handbook.pdf",
    });
    // On main this is "unsupported", which ThreadStorageFilePreview renders as
    // `Preview not available for application/pdf.`
    expect(preview.kind).not.toBe("unsupported");
  });

  it("an all-ASCII PDF (no compressed streams) is NOT 'unsupported' but is mis-classified as text", () => {
    const preview = buildFilePreview({
      contentBytes: new TextEncoder().encode(
        "%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n%%EOF\n",
      ),
      mimeType: "application/pdf",
      name: "flat.pdf",
      path: "flat.pdf",
      url: "/files/flat.pdf",
    });
    // Documents current behavior: the UTF-8 fallback wins, so the panel shows
    // the PDF's markers as source text instead of a document.
    expect(preview.kind).toBe("text");
  });
});
