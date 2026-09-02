it("keeps restored thread panes when the root compose route mounts", async () => {
  const store = renderSplitArea({
    path: "/",
    layout: twoPaneLayout("pane-1"),
    routeContent: newThreadContent,
  });

  expect(await screen.findByTestId("root-compose-view")).toBeTruthy();
  await waitFor(() => {
    expect(
      listPanes(store.get(splitLayoutAtom)?.root ?? twoPaneLayout().root).map(
        (pane) => pane.content,
      ),
    ).toEqual([
      threadContent("thr-a"),
      threadContent("thr-b"),
      newThreadContent,
    ]);
  });
});
