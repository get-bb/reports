const page = await browser.getPage("v2062");
await new Promise((r) => setTimeout(r, 1500));
const s = await page.snapshot({ interactive: true });
const text = typeof s === "string" ? s : (s.full ?? s.text ?? JSON.stringify(s));
({ url: page.url(), snap: String(text).slice(0, 5000) })
