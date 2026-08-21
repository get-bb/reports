const page = await browser.getPage("v2062");
await page.setViewport({ width: 1280, height: 900 });
await page.goto("http://localhost:17616/projects/proj_d83m68cs8i", { waitUntil: "networkidle2", timeout: 60000 });
await new Promise((r) => setTimeout(r, 4000));
const s = await page.snapshot({ interactive: true });
({ url: page.url(), snap: s.full.slice(0, 4000) })
