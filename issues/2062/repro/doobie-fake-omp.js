const page = await browser.getPage("bb2062");
await page.click("ref/e167"); // "Fake OMP" provider tab in the picker
await new Promise((r) => setTimeout(r, 2500));
await page.screenshot({ path: "/tmp/bb-reports/issues/assets/2062-02-fake-omp-picker.png" });
// Crop to the picker dialog for a close-up.
const dialog = await page.$('[role="dialog"]');
if (dialog) {
  await dialog.screenshot({ path: "/tmp/bb-reports/issues/assets/2062-03-fake-omp-picker-closeup.png" });
}
const rows = await page.evaluate(() =>
  Array.from(document.querySelectorAll('[role="listbox"][aria-label="Models"] [role="option"]')).map((el) => ({
    text: el.textContent,
    title: el.querySelector("[title]")?.getAttribute("title") ?? null,
    id: el.id,
  })),
);
({ rows })
