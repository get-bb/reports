const page = await browser.getPage("bb2093");
await new Promise((r) => setTimeout(r, 3000));
const snap = await page.snapshot({ interactive: true, track: "main" });
({ url: page.url(), snap: snap.full.slice(0, 9000) });
