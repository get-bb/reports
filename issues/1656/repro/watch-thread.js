// dev-browser script: poll the thread page and screenshot it every 2s.
const page = await browser.getPage("main");
await page.goto("http://localhost:11579/projects/proj_haaz26xrzy/threads/thr_3qxpfum5zs");
for (let i = 0; i < 14; i++) {
  await page.waitForTimeout(2000);
  const t = await page.evaluate(() => document.body.innerText);
  const idx = t.indexOf("issue 1656 repro 4\n\n");
  const body = t.slice(idx).replace(/\n{2,}/g, "\n");
  console.log("--- t+" + i * 2 + "s\n" + body.slice(0, 900));
  await saveScreenshot(await page.screenshot({ fullPage: false }), "1656-r4-" + i + ".png");
}
