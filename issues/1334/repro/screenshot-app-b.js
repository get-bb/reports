const page = await browser.getPage("main");
await new Promise((r) => setTimeout(r, 20000));
console.log(await saveScreenshot(await page.screenshot(), "1334-app-under-pressure-b.png"));
console.log(await page.title(), page.url());
