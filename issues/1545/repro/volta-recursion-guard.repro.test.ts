// Repro for get-bb/bb#1545: agent shells inherit Volta's `_VOLTA_TOOL_RECURSION`
// re-entrancy guard from a Volta-launched bb-app, which makes Volta's `node`,
// `npm`, and `npx` shims skip platform resolution and fail with
// "Volta error: Node is not available." on machines whose only Node is Volta's.
//
// `sanitizeInheritedChildProcessEnv` is the single choke point every
// bb-spawned child (provider bridges, terminals, git, script automations)
// goes through, so it is the right place to drop the guard. This test FAILS on
// 16ceb3a54 because the function only strips `BB_*` and `NODE_ENV`.
import { describe, expect, it } from "vitest";
import { sanitizeInheritedChildProcessEnv } from "../src/index.js";

describe("sanitizeInheritedChildProcessEnv (issue #1545)", () => {
  it("does not leak Volta's _VOLTA_TOOL_RECURSION guard into child processes", () => {
    // Exactly what a Volta package shim injects into bb-app's process env
    // (verified with a probe package installed through `npm i -g` under Volta).
    const env: NodeJS.ProcessEnv = {
      HOME: "/Users/example",
      PATH: "/Users/example/.volta/tools/image/node/25.0.0/bin:/Users/example/.volta/bin:/usr/bin:/bin",
      VOLTA_HOME: "/Users/example/.volta",
      _VOLTA_TOOL_RECURSION: "1",
    };

    const sanitizedEnv = sanitizeInheritedChildProcessEnv({
      env,
      // The daemon substitutes the user's login-shell PATH, which puts Volta's
      // shim directory (not the image bin dir) in front.
      shellPath: "/Users/example/.volta/bin:/usr/bin:/bin",
    });

    // VOLTA_HOME must survive: the shims need it to find the Volta layout.
    expect(sanitizedEnv.VOLTA_HOME).toBe("/Users/example/.volta");
    expect(sanitizedEnv.PATH).toBe("/Users/example/.volta/bin:/usr/bin:/bin");
    // This is the assertion that fails on main: the guard is passed through,
    // so `node` in the child resolves to Volta's shim, which sees the guard,
    // skips `Platform::current`, and returns `ErrorKind::NoPlatform`.
    expect("_VOLTA_TOOL_RECURSION" in sanitizedEnv).toBe(false);
  });
});
