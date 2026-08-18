// Repro for get-bb/bb#1762: a plugin agent tool that returns ONLY image
// content (e.g. browser_screenshot from MGrin/bb-plugin-browser) reaches the
// claude-code / pi / acp bridges as the literal string "OK".
//
// The server (apps/server/src/services/plugins/plugin-service.ts,
// normalizeAgentToolResult) correctly maps { type: "image", data, mimeType }
// to the wire item { type: "inputImage", imageUrl: "data:image/png;base64,…" }.
// The bridge-side decoder below then keeps only "inputText" items and falls
// back to "OK" when nothing is left, so the PNG is silently dropped.
import { describe, expect, it } from "vitest";
import { decodeToolCallResponsePayload } from "../src/bridge-kit/bridge-tool-calls.js";

// 1x1 transparent PNG.
const PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

describe("issue #1762: image-only tool results", () => {
  it('does not collapse an inputImage-only tool result to the string "OK"', () => {
    // Exactly what the daemon hands back for browser_screenshot's
    // { content: [{ type: "image", data, mimeType: "image/png" }] }.
    const wireResult = {
      success: true,
      contentItems: [
        {
          type: "inputImage",
          imageUrl: `data:image/png;base64,${PNG_BASE64}`,
        },
      ],
    };

    const decoded = decodeToolCallResponsePayload(wireResult);

    expect(decoded.isError).toBe(false);
    // FAILS on main: decoded.content === "OK" — the image is gone.
    expect(decoded.content).not.toBe("OK");
    expect(JSON.stringify(decoded)).toContain(PNG_BASE64);
  });

  it("keeps text but still drops a sibling image", () => {
    const decoded = decodeToolCallResponsePayload({
      success: true,
      contentItems: [
        { type: "inputText", text: "screenshot of https://example.com" },
        {
          type: "inputImage",
          imageUrl: `data:image/png;base64,${PNG_BASE64}`,
        },
      ],
    });
    expect(decoded.content).toContain("screenshot of https://example.com");
    // FAILS on main: the image part is filtered out entirely.
    expect(JSON.stringify(decoded)).toContain(PNG_BASE64);
  });
});
