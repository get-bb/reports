// Repro for get-bb/bb#1762 at the claude-code bridge layer: what the Claude
// Agent SDK (and therefore the model) receives when a bb plugin tool returns
// image-only content. The MCP proxy wraps whatever `forwardToolCall` resolved
// as a single text part, and the shared decoder already reduced an
// inputImage-only payload to "OK".
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { decodeToolCallResponsePayload } from "@get-bb/plugin-sdk/provider-bridge";
import { describe, expect, it } from "vitest";
import { buildBridgeMcpServer } from "../tool-proxy-mcp.js";

const PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

describe("issue #1762: browser_screenshot through the claude-code MCP proxy", () => {
  it("delivers the image to the model instead of the string OK", async () => {
    // The daemon's reply for a plugin tool that returned
    // { content: [{ type: "image", data, mimeType: "image/png" }] }.
    const daemonReply = {
      success: true,
      contentItems: [
        { type: "inputImage", imageUrl: `data:image/png;base64,${PNG_BASE64}` },
      ],
    };
    const server = buildBridgeMcpServer(
      [{ name: "browser_screenshot", description: "A PNG of the current page.", inputSchema: { type: "object" } }],
      // This is exactly what createBridgeSessionRegistry().handleToolCallResponse
      // resolves the pending forwardToolCall promise with.
      async () => decodeToolCallResponsePayload(daemonReply),
    );
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.instance.connect(serverTransport);
    const client = new Client({ name: "test", version: "1.0.0" });
    await client.connect(clientTransport);

    const result = await client.callTool({ name: "browser_screenshot", arguments: {} });
    await client.close();

    const content = result.content as Array<{ type: string; text?: string; data?: string }>;
    // What the model actually sees on main:
    //   [{ type: "text", text: "OK" }]
    expect(content).not.toEqual([{ type: "text", text: "OK" }]);
    expect(content.some((part) => part.type === "image" && part.data === PNG_BASE64)).toBe(true);
  });
});
