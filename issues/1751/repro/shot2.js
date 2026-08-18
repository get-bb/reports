const page = await browser.getPage("main");
await page.setViewportSize({ width: 1280, height: 900 });
const p = await saveScreenshot(await page.screenshot({ clip: { x: 440, y: 360, width: 720, height: 200 }, scale: "device" }), "1751-zoom.png");
console.log(p);
// Annotate: computed colors of first tokens in the sh vs python assistant blocks
const info = await page.evaluate(() => {
  const blocks = [...document.querySelectorAll(".bb-code-highlight code")].slice(2);
  return blocks.map((b) => ({
    lang: b.className,
    tokens: [...b.querySelectorAll("span[class^='sh__token--']")].slice(0, 12).map((s) => ({
      t: s.className.replace("sh__token--", ""), v: s.textContent, color: getComputedStyle(s).color,
    })),
  }));
});
console.log(JSON.stringify(info, null, 1));
