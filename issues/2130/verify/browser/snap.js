const page = await browser.getPage("v2130");
const s = await page.snapshot({ interactive: true, track: "snap" });
({ url: page.url(), full: s.full.slice(0, 7000) });
