const page = await browser.getPage("v2062");
await page.click("ref/e167");
await new Promise((r) => setTimeout(r, 4000));
await page.screenshot({ path: "/tmp/bb-reports/issues/2062/verify/v-02-fake-omp-picker.png" });
const rows = await page.evaluate(() =>
  Array.from(document.querySelectorAll('[role="listbox"][aria-label="Models"] [role="option"]')).map((el) => ({
    text: el.textContent,
    title: el.querySelector("[title]")?.getAttribute("title") ?? null,
    align: getComputedStyle(el.querySelector("span")).textAlign,
  })),
);
({ rows })
