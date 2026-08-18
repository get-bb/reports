const APP = "http://localhost:13543";
const A = "01M0A05KVENPMP0YNGF9EBMK7B";
const page = await browser.getPage("main");
await page.setViewportSize({ width: 1400, height: 900 });
await page.goto(`${APP}/plugins/tasks/tasks/task/RPA-1`, { waitUntil: "load", timeout: 60000 });
await page.waitForTimeout(6000);
console.log("url", page.url());
console.log("aside count", await page.locator("aside").count(), "nav count", await page.locator("nav").count());
console.log("aside/nav texts:", JSON.stringify(await page.locator("aside, nav").allInnerTexts()));
console.log("Repro Alpha anywhere:", await page.getByText("Repro Alpha", { exact: true }).count());
const html = await page.evaluate(() => {
  const els = [...document.querySelectorAll("*")].filter(e => e.childElementCount === 0 && e.textContent.trim() === "Repro Alpha");
  return els.map(e => { let p = e, chain = []; while (p && chain.length < 8) { chain.push(p.tagName + (p.className ? "." + String(p.className).split(" ").slice(0,2).join(".") : "")); p = p.parentElement; } return chain.join(" < "); });
});
console.log(JSON.stringify(html, null, 1));
saveScreenshot(await page.screenshot(), "verify-1702-taskpage.png");
