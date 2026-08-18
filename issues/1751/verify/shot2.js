const page = await browser.getPage("main");
await page.setViewportSize({ width: 1280, height: 900 });
await page.goto("http://localhost:15936/projects/proj_zc3nk34k2u/threads/thr_n8fsq6yqc5", { waitUntil: "commit", timeout: 150000 });
await page.waitForSelector(".bb-code-highlight", { timeout: 60000 }).catch(e => console.log("no highlight:", e.message));
await page.waitForTimeout(3000);
const p = await saveScreenshot(await page.screenshot({ timeout: 200000 }), "1751-verify2-thread.png");
console.log(p);
const info = await page.evaluate(() => {
  const blocks = [...document.querySelectorAll(".bb-code-highlight code")];
  return blocks.map((b) => ({
    lang: b.className,
    tokens: [...b.querySelectorAll("span[class^='sh__token--']")].filter(s=>s.textContent.trim()).slice(0, 12).map((s) => ({
      t: s.className.replace("sh__token--", ""), v: s.textContent, color: getComputedStyle(s).color,
    })),
  }));
});
console.log(JSON.stringify(info, null, 1));
