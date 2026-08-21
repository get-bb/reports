const page = await browser.getPage("bb2062");
await page.setViewport({ width: 1280, height: 900 });
await page.goto("http://localhost:17877/", { waitUntil: "networkidle2", timeout: 45000 });
await new Promise((r) => setTimeout(r, 3000));
const s = await page.snapshot({ interactive: true });
({ url: page.url(), title: await page.title(), snap: s.full.slice(0, 5000) })
