// @vitest-environment jsdom
import { writeFileSync } from "node:fs";
import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { loadPluginApp, renderSlot } from "@get-bb/plugin-sdk/testing/app";
import { decodeCodexInteractiveRequest } from "./interactive-requests.js";
import {
  buildCodexMcpElicitationResponse,
  codexMcpElicitationSchema,
} from "./mcp-elicitation.js";
import fixture from "./fixtures/mcp-tool-approval-elicitation.json";

const app = await loadPluginApp(() => import("../app.js"));
const registration = app.pendingInteractions.find(
  (interaction) => interaction.id === "mcp-elicitation",
);
if (!registration) throw new Error("Missing MCP elicitation renderer");

afterEach(cleanup);

const renderedCards: string[] = [];
afterAll(() => {
  writeFileSync(
    "issue-6365-harness.html",
    `<!doctype html><html lang="en"><meta charset="utf-8"><title>Issue 6365 boundary fixtures</title><style>body{font:16px/1.5 system-ui;margin:36px;max-width:860px;background:#fafaf8;color:#1a1a1a}section{background:white;border:1px solid #ccc;padding:20px;margin:20px 0}button{padding:8px 16px;margin:6px;border:1px solid #888;border-radius:6px;background:white}svg{width:20px;height:20px}h2{font-size:18px}</style><h1>Issue 6365 boundary fixtures</h1><p>Actual Codex plugin renderer DOM from automated tests. Synthetic metadata, not a live Browser Use session. Basic harness CSS, not BB application styling.</p>${renderedCards.join("")}</html>`,
  );
});

function decodeMetadata(metadata: Record<string, unknown>) {
  const decoded = decodeCodexInteractiveRequest({
    ...fixture,
    params: {
      ...fixture.params,
      serverName: "cua_repl",
      message: "Browser capability consent",
      _meta: metadata,
    },
  });
  if (!decoded || !("data" in decoded.payload)) {
    throw new Error("Expected an extension interaction");
  }
  return codexMcpElicitationSchema.parse(decoded.payload.data);
}

describe("issue 6365 boundary investigation", () => {
  it("accepts the trusted tool-approval fixture on the browser server", () => {
    const payload = decodeMetadata({
      ...fixture.params._meta,
      additive_field: "new metadata is permitted",
    });
    expect(payload.kind).toBe("tool_approval");
    expect(buildCodexMcpElicitationResponse(payload, { action: "accept" }))
      .toEqual({ action: "accept", content: {}, _meta: null });
    const slot = renderSlot(registration, {
      interaction: {
        id: "pint_control",
        threadId: "thr_control",
        title: payload.message,
        payload,
        createdAt: 0,
        expiresAt: null,
      },
      submit: vi.fn(async () => {}),
      cancel: vi.fn(async () => {}),
    });
    expect(slot.getByRole("button", { name: "Allow" })).toBeTruthy();
    renderedCards.push(`<section><h2>Valid fixture: approval available</h2>${slot.container.innerHTML}</section>`);
    console.log("control: tool_approval; Allow available");
  });

  it.each([
    ["non-array persistence", { persist: "session" }],
    ["non-array display parameters", { tool_params_display: {} }],
    ["non-string description", { tool_description: 17 }],
  ])("recreates the safe fallback for %s", (name, changes) => {
    const payload = decodeMetadata({ ...fixture.params._meta, ...changes });
    expect(payload).toEqual({
      kind: "unsupported",
      serverName: "cua_repl",
      message: "Browser capability consent",
      nativeMode: "form",
      reason: "The tool approval details are incomplete or unsupported.",
    });
    if (payload.kind !== "unsupported") {
      throw new Error("Expected unsupported metadata");
    }
    const slot = renderSlot(registration, {
      interaction: {
        id: "pint_rejected",
        threadId: "thr_rejected",
        title: payload.message,
        payload,
        createdAt: 0,
        expiresAt: null,
      },
      submit: vi.fn(async () => {}),
      cancel: vi.fn(async () => {}),
    });
    expect(slot.getByText(payload.reason)).toBeTruthy();
    expect(slot.getAllByRole("button").map((button) => button.textContent))
      .toEqual(["Decline"]);
    expect(() => buildCodexMcpElicitationResponse(payload, { action: "accept" }))
      .toThrow();
    expect(buildCodexMcpElicitationResponse(payload, { action: "decline" }))
      .toEqual({ action: "decline", content: null, _meta: null });
    renderedCards.push(`<section><h2>Invalid fixture: ${name}</h2>${slot.container.innerHTML}</section>`);
    console.log(`${name}: unsupported; only Decline; acceptance rejected`);
  });
});
