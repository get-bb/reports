const page = await browser.getPage("main");
await page.reload();
await page.waitForTimeout(6000);
const strip = await page.locator("[data-tab-pill-close]").evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));
console.log("STRIP AFTER RELOAD:", JSON.stringify(strip));
await saveScreenshot(await page.screenshot(), "1773-verify-after-reload-D.png");
