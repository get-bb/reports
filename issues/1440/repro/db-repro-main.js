// Repro on base commit: click empty sidebar space, press Ctrl+A (Cmd+A on macOS),
// then report what the native selection contains. Then drag across the sidebar.
const page = await browser.getPage("bb1440");
await page.setViewportSize({ width: 1400, height: 900 });
await page.waitForTimeout(500);
// deselect anything and click into empty sidebar space (below "No threads")
await page.evaluate(() => window.getSelection().removeAllRanges());
await saveScreenshot(await page.screenshot(), "1440-before.png");
await page.mouse.click(150, 500);
await page.keyboard.press("Control+A");
await page.waitForTimeout(300);
const sel = await page.evaluate(() => {
  const s = window.getSelection();
  return {
    activeElement: document.activeElement && document.activeElement.tagName,
    rangeCount: s.rangeCount,
    text: s.toString(),
    bodyUserSelect: getComputedStyle(document.body).userSelect,
    sidebarLabelUserSelect: getComputedStyle(
      [...document.querySelectorAll("span,div")].find((n) => n.textContent === "New thread" && n.children.length === 0) || document.body,
    ).userSelect,
  };
});
console.log("--- after Ctrl+A ---");
console.log(JSON.stringify(sel, null, 2));
await saveScreenshot(await page.screenshot(), "1440-select-all.png");

// Drag across the sidebar from top-left to below the thread list
await page.evaluate(() => window.getSelection().removeAllRanges());
await page.mouse.move(15, 60);
await page.mouse.down();
await page.mouse.move(150, 200, { steps: 8 });
await page.mouse.move(300, 300, { steps: 8 });
await page.mouse.up();
await page.waitForTimeout(300);
const drag = await page.evaluate(() => window.getSelection().toString());
console.log("--- after drag across sidebar ---");
console.log(JSON.stringify(drag));
await saveScreenshot(await page.screenshot(), "1440-drag-sidebar.png");
