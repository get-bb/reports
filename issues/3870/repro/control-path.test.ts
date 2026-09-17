import { describe, expect, it, vi } from "vitest";
import { createProjectRequestSchema } from "@bb/server-contract";
import { setupCommandOutputTestEnvironment, collectLogPayloads, runCommand, stubServerApi } from "../helpers/command-output-harness.js";
import { registerProjectCommands } from "../../commands/project.js";

const path = `/tmp/verification-${String.fromCharCode(27)}[35msample${String.fromCharCode(27)}[0m`;

describe("project path terminal safety", () => {
  setupCommandOutputTestEnvironment();

  it("rejects terminal controls at the request boundary", () => {
    const parsed = createProjectRequestSchema.safeParse({
      name: "Verification",
      source: { type: "local_path", hostId: "host-test-001", path },
    });
    process.stderr.write(JSON.stringify({ accepted: parsed.success, preserved: parsed.success && parsed.data.source.path === path }) + "\n");
    expect(parsed.success).toBe(false);
  });

  it("does not emit terminal controls from a project list response", async () => {
    stubServerApi({ "v1.projects.$get": vi.fn(async () => [{
      id: "proj-verification", name: "Verification",
      sources: [{ type: "local_path", hostId: "host-test-001", path }],
      createdAt: 1, updatedAt: 2,
    }]) });
    await runCommand(["project", "list"], (program) => registerProjectCommands(program, () => "http://server"));
    const output = collectLogPayloads(vi.mocked(console.log)).join("\n");
    process.stderr.write(JSON.stringify({ output, containsEscape: output.includes(String.fromCharCode(27)) }) + "\n");
    expect(output).not.toContain(String.fromCharCode(27));
  });
});
