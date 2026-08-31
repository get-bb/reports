// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TabPill } from "./tab-pill";

afterEach(cleanup);

describe("TabPill middle click", () => {
  it("closes a closable tab after a middle click", () => {
    const onClose = vi.fn();
    const onSelect = vi.fn();
    render(
      <TabPill
        label="Browser"
        title="Browser"
        isActive={false}
        onSelect={onSelect}
        closeAction={{ onClose, closeLabel: "Close Browser" }}
      />,
    );

    fireEvent(
      screen.getByRole("button", { name: "Browser" }),
      new MouseEvent("auxclick", {
        bubbles: true,
        button: 1,
        cancelable: true,
      }),
    );

    expect(onClose).toHaveBeenCalledOnce();
    expect(onSelect).not.toHaveBeenCalled();
  });
});
