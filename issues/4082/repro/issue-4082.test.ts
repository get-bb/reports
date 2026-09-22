import { mkdtempSync, writeFileSync, chmodSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it, vi } from "vitest";
import { buildClaudeCodeModels } from "./model-list.js";
import { listClaudeCodeBridgeModels } from "./bridge/model-list.js";

const queryMock = vi.hoisted(() => vi.fn());
vi.mock("@anthropic-ai/claude-agent-sdk", () => ({ query: queryMock }));

it("includes a previously unknown model returned by the installed CLI probe", async () => {
  const dir = mkdtempSync(join(tmpdir(), "provider-discovery-"));
  const executable = join(dir, "claude");
  writeFileSync(executable, "#!/bin/sh\nexit 0\n");
  chmodSync(executable, 0o755);
  const close = vi.fn();
  queryMock.mockReturnValue({
    initializationResult: async () => ({ models: [{
      value: "default",
      resolvedModel: "claude-future-6",
      displayName: "Future 6",
      description: "Synthetic discovery fixture",
    }] }),
    close,
  });
  try {
    const result = await listClaudeCodeBridgeModels({ PATH: dir, HOME: dir });
    expect(queryMock).toHaveBeenCalledWith(expect.objectContaining({
      options: expect.objectContaining({ pathToClaudeCodeExecutable: executable }),
    }));
    expect(result.models).toContainEqual(expect.objectContaining({
      model: "claude-future-6", isDefault: true,
    }));
    expect(close).toHaveBeenCalledOnce();
  } finally {
    rmSync(dir, { recursive: true, force: true });
    vi.clearAllMocks();
  }
});

it("cannot invent an unknown model absent from discovery and the curated catalog", () => {
  expect(buildClaudeCodeModels([]).models.some(model => model.model === "claude-future-6")).toBe(false);
});
