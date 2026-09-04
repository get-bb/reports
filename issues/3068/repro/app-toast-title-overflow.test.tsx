// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { AppToastContent } from "@/components/ui/app-toast";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it("offers a recovery path when a title-only toast is truncated", () => {
  vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockReturnValue(600);
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(300);

  render(
    <AppToastContent
      title="The requested operation cannot continue while the workspace is occupied"
      tone="error"
      notificationId="notification-7"
    />,
  );

  expect(screen.queryByRole("button", { name: "Show more" })).not.toBeNull();
});
