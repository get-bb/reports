const page = await browser.getPage("main");
await page.goto("http://localhost:11159/projects/proj_idaxikp2th/threads/thr_brv9x6uw3e");
await page.setViewportSize({ width: 1280, height: 1000 });
for (let i = 0; i < 20; i++) {
  await page.waitForTimeout(3000);
  const t = await page.evaluate(() => document.body.innerText);
  const idx = t.indexOf("issue 1656 verify\n\n");
  const body = t.slice(idx).replace(/\n{2,}/g, "\n");
  console.log("--- t+" + i * 3 + "s\n" + body.slice(0, 700));
  console.log(await saveScreenshot(await page.screenshot({ fullPage: false }), "1656-verify-" + i + ".png"));
  if (/Final runbook/.test(body) && !/Working/.test(body)) break;
}
