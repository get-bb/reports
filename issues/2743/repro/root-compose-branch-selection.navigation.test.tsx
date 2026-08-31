// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useScopedBranchSelection } from "./root-compose-branch-selection";

describe("new-thread branch selection navigation", () => {
  it("keeps the worktree base branch after the composer remounts", () => {
    const args = {
      environmentValue: "host:host_1:worktree",
      projectId: "proj_1",
    };
    const first = renderHook(() => useScopedBranchSelection(args));

    act(() => first.result.current.onBranchChange("origin/release"));
    expect(first.result.current.selectedBranch?.name).toBe("origin/release");
    first.unmount();

    const second = renderHook(() => useScopedBranchSelection(args));
    expect(second.result.current.selectedBranch?.name).toBe("origin/release");
  });
});
