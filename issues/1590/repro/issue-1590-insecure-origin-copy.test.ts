// @vitest-environment jsdom
// Issue #1590: on a plain-HTTP, non-loopback origin browsers do not expose
// navigator.clipboard at all (the Clipboard interface is [SecureContext]).
// The shared helper must still copy via the synchronous editing command that
// remains available in a user gesture. Copy to apps/app/src/lib/ and run:
//   cd apps/app && pnpm exec vitest run --config vitest.config.ts src/lib/issue-1590-insecure-origin-copy.test.ts
// FAILS on 16ceb3a54 (helper reports "Failed to copy"), PASSES with PR #1589.
import { afterEach, describe, expect, it, vi } from "vitest";

const toastMocks = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
vi.mock("@/components/ui/app-toast", () => ({ appToast: toastMocks }));

import { copyToClipboardWithToast } from "./clipboard";

afterEach(() => {
  toastMocks.error.mockReset();
  toastMocks.success.mockReset();
  document.body.replaceChildren();
});

describe("issue #1590: copy on an insecure (plain-HTTP LAN) origin", () => {
  it("copies through document.execCommand('copy') when navigator.clipboard is absent", async () => {
    // Exactly what Chrome/Firefox/Safari expose on http://192.168.x.x:port
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: undefined,
    });
    let copiedValue: string | null = null;
    Object.defineProperty(document, "execCommand", {
      configurable: true,
      value: vi.fn((command: string) => {
        if (command !== "copy") return false;
        const active = document.activeElement;
        copiedValue =
          active instanceof HTMLTextAreaElement ? active.value : null;
        return true;
      }),
    });

    const ok = await copyToClipboardWithToast("hello from LAN", {
      successMessage: "Copied",
      errorMessage: "Failed to copy",
    });

    expect(ok).toBe(true);
    expect(copiedValue).toBe("hello from LAN");
    expect(toastMocks.error).not.toHaveBeenCalled();
    expect(toastMocks.success).toHaveBeenCalledWith("Copied");
  });
});
