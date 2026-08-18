const page = await browser.getPage("main");
await page.setViewportSize({ width: 1280, height: 900 });
await page.goto("http://localhost:16052/projects/proj_t4qbxr2qqk/threads/thr_qpb587ex2y", { waitUntil: "commit", timeout: 150000 });
await page.waitForSelector(".bb-code-highlight", { timeout: 60000 }).catch(e => console.log("no highlight:", e.message));
await page.waitForTimeout(3000);
const p = await saveScreenshot(await page.screenshot({ timeout: 200000 }), "1751-verify-thread.png");
console.log(p);
const info = await page.evaluate(() => {
  const blocks = [...document.querySelectorAll(".bb-code-highlight code")];
  return blocks.map((b) => ({
    lang: b.className,
    tokens: [...b.querySelectorAll("span[class^='sh__token--']")].slice(0, 12).map((s) => ({
      t: s.className.replace("sh__token--", ""), v: s.textContent, color: getComputedStyle(s).color,
    })),
  }));
});
console.log(JSON.stringify(info));
