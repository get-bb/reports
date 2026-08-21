const page = await browser.getPage("v2062");
await page.goto("http://localhost:17616/projects/proj_d83m68cs8i", { waitUntil: "networkidle2", timeout: 60000 });
await new Promise((r) => setTimeout(r, 4000));
await page.click('button[aria-label^="Provider, model and reasoning"]');
await new Promise((r) => setTimeout(r, 2000));
await page.click('[role="dialog"] button[title="Claude Code"], [role="dialog"] button[title="Claude"]').catch(() => {});
await new Promise((r) => setTimeout(r, 4000));
const info = await page.evaluate(() => {
  const opts = Array.from(document.querySelectorAll('[role="listbox"][aria-label="Models"] [role="option"]'));
  const reasoning = Array.from(document.querySelectorAll('[role="dialog"] button')).filter((b) => ["Low", "Medium", "High"].includes(b.textContent.trim()));
  const dlg = document.querySelector('[role="dialog"]');
  return {
    dialogWidth: dlg?.getBoundingClientRect().width,
    rows: opts.slice(0, 3).map((el) => ({ text: el.textContent, labelAlign: getComputedStyle(el.querySelector("span span") ?? el.querySelector("span")).textAlign, height: el.getBoundingClientRect().height })),
    reasoning: reasoning.slice(0, 2).map((b) => ({ text: b.textContent, align: getComputedStyle(b.querySelector("span")).textAlign })),
  };
});
const dlg = await page.$('[role="dialog"]');
if (dlg) await dlg.screenshot({ path: "/tmp/bb-reports/issues/2062/verify/v-04-claude-picker-pr2063-live.png" });
info
