it("stays expanded while a composer overlay trigger is held", () => {
  mocks.isCompactViewport = true;
  vi.useFakeTimers();

  try {
    render(
      <FollowUpPromptBox
        {...createFollowUpPromptBoxProps({ kind: "ready" })}
      />,
    );
    const input = screen.getByRole("textbox", { name: "Follow-up prompt" });
    const trigger = screen.getByRole("button", { name: "Submit" });
    trigger.setAttribute("aria-haspopup", "menu");
    trigger.setAttribute("aria-expanded", "false");
    act(() => input.focus());

    act(() => {
      fireEvent.pointerDown(trigger);
      input.blur();
      vi.advanceTimersByTime(20);
    });

    expect(
      screen.getByTestId("prompt-box").getAttribute("data-compact"),
    ).toBe("false");

    act(() => {
      fireEvent.pointerUp(trigger);
      trigger.setAttribute("aria-expanded", "true");
      vi.runOnlyPendingTimers();
      trigger.setAttribute("aria-expanded", "false");
      trigger.focus();
      trigger.blur();
      vi.advanceTimersByTime(20);
    });

    expect(
      screen.getByTestId("prompt-box").getAttribute("data-compact"),
    ).toBe("true");
  } finally {
    vi.useRealTimers();
  }
});
