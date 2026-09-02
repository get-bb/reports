it("keeps restored thread panes when the root compose route mounts", async () => {
  const store = renderSplitArea({
    path: "/",
    layout: twoPaneLayout("pane-1"),
    routeContent: newThreadContent,
  });

  expect(await screen.findByTestId("root-compose-view")).toBeTruthy();
  await waitFor(() => {
    const restored = store.get(splitLayoutAtom);
    if (restored === null) {
      throw new Error("Expected a restored split layout");
    }
    expect(
      listPanes(restored.root).map((pane) => pane.content),
    ).toEqual([
      threadContent("thr-a"),
      threadContent("thr-b"),
      newThreadContent,
    ]);
  });
});
