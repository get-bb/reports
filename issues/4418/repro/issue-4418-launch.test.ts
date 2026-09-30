import { afterEach, describe, expect, it, vi } from "vitest";
import type { Options, SDKMessage } from "@anthropic-ai/claude-agent-sdk";

const { queryMock } = vi.hoisted(() => ({ queryMock: vi.fn() }));

vi.mock("@anthropic-ai/claude-agent-sdk", () => ({ query: queryMock }));

import { buildSessionOptions } from "../session-options.js";
import { SdkSession } from "../sdk-session.js";

afterEach(() => {
  vi.clearAllMocks();
});

describe("issue 4418 offline launch-boundary diagnostic", () => {
  const cases = ["/tmp/qa-project", "/tmp/qa-personal"].flatMap((cwd) =>
    ["append", "replace"].flatMap((instructionMode) =>
      [false, true].map((resume) => ({ cwd, instructionMode, resume })),
    ),
  );

  it.each(cases)(
    "preserves context inputs for cwd=$cwd mode=$instructionMode resume=$resume",
    async ({ cwd, instructionMode, resume }) => {
      const captured: Options[] = [];
      queryMock.mockImplementation(({ options }: { options: Options }) => {
        captured.push(options);
        return {
          [Symbol.asyncIterator]() {
            return {
              async next(): Promise<IteratorResult<SDKMessage>> {
                return { done: true, value: undefined };
              },
            };
          },
        };
      });
      const mode = instructionMode === "append" ? "append" : "replace";
      const sessionOptions = buildSessionOptions(
        {
          cwd,
          instructionMode: mode,
          baseInstructions: "Synthetic identity and skills context.",
          permissionMode: "auto",
          permissionScope: "workspace",
          serviceTier: "default",
          workflowsEnabled: false,
          chromeEnabled: false,
          disable1MContext: false,
        },
        { HOME: "/tmp/qa-home", PATH: "/tmp/qa-empty-path" },
      );
      let finish: (() => void) | undefined;
      const done = new Promise<void>((resolve) => {
        finish = resolve;
      });
      const session = new SdkSession(sessionOptions, () => {}, () => finish?.());
      session.start(resume ? "qa-session" : undefined);
      await done;
      expect(captured).toHaveLength(1);
      expect(captured[0]).toMatchObject({
        cwd,
        settingSources: ["user", "project", "local"],
        env: { HOME: "/tmp/qa-home", PATH: "/tmp/qa-empty-path" },
        settings: { autoMemoryEnabled: true },
        persistSession: true,
        permissionMode: "auto",
        systemPrompt:
          mode === "append"
            ? {
                type: "preset",
                preset: "claude_code",
                append: "Synthetic identity and skills context.",
              }
            : "Synthetic identity and skills context.",
      });
      if (resume) {
        expect(captured[0]).toHaveProperty("resume", "qa-session");
      } else {
        expect(captured[0]).not.toHaveProperty("resume");
      }
    },
  );
});
