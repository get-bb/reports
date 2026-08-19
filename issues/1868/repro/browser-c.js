const page = await browser.getPage("main");
await page.goto("about:blank");
await page.goto("http://localhost:13806/projects/proj_ks8z3m2awr/threads/thr_mfus3sx7bg");
for (const ms of [700, 1500, 3000, 6000]) {
  await page.waitForTimeout(ms === 700 ? 700 : ms - (ms === 1500 ? 700 : ms === 3000 ? 1500 : 3000));
  const p = await saveScreenshot(await page.screenshot(), `1868-c-${ms}.png`);
  const txt = await page.evaluate(() => document.body.innerText);
  console.log(`== ${ms}ms ${p}`);
  console.log(txt.split("\n").filter((l) => /Worked for|Loading|Working|Sweep|workflow/i.test(l)).join(" | "));
}
