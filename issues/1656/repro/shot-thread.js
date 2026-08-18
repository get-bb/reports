// dev-browser script: screenshot the thread page scrolled to the steer row.
// Usage: dev-browser --browser bb1656 --headless run shot-thread.js  (edit NAME first)
const NAME = "1656-followup-turn-main.png";
const page = await browser.getPage("main");
await page.setViewportSize({ width: 1280, height: 1100 });
if (!page.url().includes("thr_3qxpfum5zs")) {
  await page.goto("http://localhost:11579/projects/proj_haaz26xrzy/threads/thr_3qxpfum5zs");
  await page.waitForTimeout(6000);
}
await page.waitForTimeout(1500);
// scroll the steer row into view
await page.evaluate(() => {
  const els = [...document.querySelectorAll("*")].filter(
    (e) => e.children.length === 0 && /Follow-up task. Send these/.test(e.textContent || ""),
  );
  if (els[0]) els[0].scrollIntoView({ block: "center" });
});
await page.waitForTimeout(800);
const t = await page.evaluate(() => document.body.innerText);
const idx = t.indexOf("issue 1656 repro 4\n\n");
console.log(t.slice(idx).replace(/\n{2,}/g, "\n").slice(0, 2000));
console.log(await saveScreenshot(await page.screenshot({ fullPage: false }), NAME));
