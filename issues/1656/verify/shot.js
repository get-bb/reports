const page = await browser.getPage("main");
if (!page.url().includes("thr_brv9x6uw3e")) {
  await page.goto("http://localhost:11159/projects/proj_idaxikp2th/threads/thr_brv9x6uw3e");
  await page.waitForTimeout(5000);
}
await page.setViewportSize({ width: 1280, height: 1100 });
await page.waitForTimeout(1500);
await page.evaluate(() => {
  const els = [...document.querySelectorAll("*")].filter(
    (e) => e.children.length === 0 && /Explore only, do not apply/.test(e.textContent || ""),
  );
  if (els[0]) els[0].scrollIntoView({ block: "center" });
});
await page.waitForTimeout(800);
const t = await page.evaluate(() => document.body.innerText);
const idx = t.indexOf("issue 1656 verify\n\n");
console.log(t.slice(idx).replace(/\n{2,}/g, "\n").slice(0, 1500));
console.log(await saveScreenshot(await page.screenshot({ fullPage: false }), "1656-verify-shot.png"));
