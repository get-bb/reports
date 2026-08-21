const page = await browser.getPage("bb2062");
// Wait for model rows to render (the bridge spawns the agent for discovery).
await page.waitForFunction(
  () => document.querySelectorAll('[role="dialog"] [role="option"]').length > 0,
  { timeout: 40000 },
);
await new Promise((r) => setTimeout(r, 800));
await page.screenshot({ path: "/tmp/bb-reports/issues/assets/2062-02-fake-omp-picker.png" });
const dialog = await page.$('[role="dialog"]');
if (dialog) {
  await dialog.screenshot({ path: "/tmp/bb-reports/issues/assets/2062-03-fake-omp-picker-closeup.png" });
}
const rows = await page.evaluate(() =>
  Array.from(document.querySelectorAll('[role="dialog"] [role="option"]')).map((el) => ({
    text: el.textContent,
    title: el.querySelector("[title]")?.getAttribute("title") ?? null,
    id: el.id,
  })),
);
({ rows })
