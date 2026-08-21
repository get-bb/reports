const page = await browser.getPage("bb2062");
const tag = "base";
// Clear the search box, then switch to the Claude provider tab.
const search = await page.$('[role="dialog"] input[aria-label="Search models"]');
if (search) {
  await search.click({ clickCount: 3 });
  await page.keyboard.press("Backspace");
}
const claude = await page.$('[role="dialog"] button[title="Claude Code"], [role="dialog"] button[title="Claude"]');
if (!claude) throw new Error("no Claude tab");
await claude.click();
await page.waitForFunction(
  () => Array.from(document.querySelectorAll('[role="dialog"] button')).some((b) => /Opus/.test(b.textContent || "")),
  { timeout: 30000 },
);
await new Promise((r) => setTimeout(r, 800));
const dialog = await page.$('[role="dialog"]');
await dialog.screenshot({ path: `/tmp/bb-reports/issues/assets/2062-05-claude-picker-${tag}.png` });
const box = await dialog.boundingBox();
const rows = await page.evaluate(() =>
  Array.from(document.querySelectorAll('[role="dialog"] button'))
    .filter((b) => b.querySelector("[title]"))
    .map((el) => el.textContent),
);
({ height: box.height, rows })
