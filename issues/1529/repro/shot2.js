const page = await browser.getPage("bb1529");
await page.setViewportSize({ width: 1400, height: 1000 });
await page.goto("http://localhost:12031/projects/proj_tau8244si4/threads/thr_pvxfiskgsx");
await new Promise((r) => setTimeout(r, 6000));
// Expand the "Ran N commands" group if collapsed.
const clicked = await page.evaluate(() => {
  const el = Array.from(document.querySelectorAll("button,div,span")).find((e) => /Ran \d+ commands/.test(e.textContent ?? "") && e.children.length < 4);
  if (el) { el.click(); return el.textContent; }
  return null;
});
console.log("clicked", clicked);
await new Promise((r) => setTimeout(r, 1500));
// Scroll so the command list is in view.
const info = await page.evaluate(() => {
  const target = Array.from(document.querySelectorAll("*")).find((e) => e.children.length === 0 && /echo hi; git status/.test(e.textContent ?? ""));
  if (target) { target.scrollIntoView({ block: "center" }); return target.textContent; }
  return null;
});
console.log("scrolled to", info);
await new Promise((r) => setTimeout(r, 1200));
console.log(await saveScreenshot(await page.screenshot(), "1529-thread-commands.png"));
// Now scroll so the "Step 3" report heading is at top.
const info2 = await page.evaluate(() => {
  const target = Array.from(document.querySelectorAll("h1,h2,h3,h4,strong,p")).find((e) => /^Step 3$/.test((e.textContent ?? "").trim()));
  if (target) { target.scrollIntoView({ block: "start" }); return target.textContent; }
  return null;
});
console.log("scrolled to", info2);
await new Promise((r) => setTimeout(r, 1200));
console.log(await saveScreenshot(await page.screenshot(), "1529-thread-report.png"));
