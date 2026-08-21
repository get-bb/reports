const page = await browser.getPage("bb2062");
await page.click("ref/e176"); // "oh-my-pi" (real `omp acp`) provider tab
// Real omp advertises 72 models; discovery probes each for reasoning levels.
await page.waitForFunction(
  () => Array.from(document.querySelectorAll('[role="dialog"] button')).some((b) => /GPT-5\.1 Codex/.test(b.textContent || "")),
  { timeout: 80000 },
);
await new Promise((r) => setTimeout(r, 800));
// Type into the search box so the duplicate rows are adjacent and visible.
const search = await page.$('[role="dialog"] input[aria-label="Search models"]');
if (search) {
  await search.type("GPT-5.1");
  await new Promise((r) => setTimeout(r, 600));
}
await page.screenshot({ path: "/tmp/bb-reports/issues/assets/2062-04-real-omp-page.png" });
const dialog = await page.$('[role="dialog"]');
if (dialog) {
  await dialog.screenshot({ path: "/tmp/bb-reports/issues/assets/2062-03-real-omp-picker.png" });
}
const rows = await page.evaluate(() =>
  Array.from(document.querySelectorAll('[role="dialog"] [role="option"], [role="dialog"] button'))
    .filter((b) => b.querySelector("[title]"))
    .map((el) => ({ text: el.textContent, title: el.querySelector("[title]")?.getAttribute("title") ?? null })),
);
({ count: rows.length, rows })
