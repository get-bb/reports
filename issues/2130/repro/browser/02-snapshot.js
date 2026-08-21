const page = await browser.getPage("bb2130");
await new Promise((r) => setTimeout(r, 3000));
const s = await page.snapshot({ interactive: true, track: "main" });
({ url: page.url(), snap: s.full.slice(0, 8000) });
