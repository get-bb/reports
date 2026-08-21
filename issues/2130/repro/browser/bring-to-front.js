const page = await browser.getPage("bb2130");
await page.bringToFront();
await new Promise((r) => setTimeout(r, 1000));
({ visibility: await page.evaluate(() => document.visibilityState), ok: true });
