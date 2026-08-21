const page = await browser.getPage("bb2093");
await page.click("ref/e102");
await new Promise((r) => setTimeout(r, 2000));
const snap = await page.snapshot({ interactive: true, track: "main" });
({ url: page.url(), snap: snap.full.slice(-6000) });
