const page = await browser.getPage("bb2062");
const name = "02-fake-omp-picker";
await page.screenshot({ path: `/tmp/bb-reports/issues/assets/2062-${name}.png` });
const dialog = await page.$('[role="dialog"]');
if (dialog) {
  await dialog.screenshot({ path: `/tmp/bb-reports/issues/assets/2062-${name}-closeup.png` });
}
const rows = await page.evaluate(() =>
  Array.from(document.querySelectorAll('[role="dialog"] button'))
    .filter((b) => b.querySelector("[title]"))
    .map((el) => ({
      text: el.textContent,
      title: el.querySelector("[title]")?.getAttribute("title") ?? null,
    })),
);
({ rows })
