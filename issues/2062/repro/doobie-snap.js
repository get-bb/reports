const page = await browser.getPage("bb2062");
const s = await page.snapshot({ interactive: true });
({ url: page.url(), snap: String(typeof s === "string" ? s : JSON.stringify(s)).slice(0, 6000) })
