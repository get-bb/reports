const page = await browser.getPage("bb2062");
await page.goto("http://localhost:17877/projects/proj_cfd7bkuva5", { waitUntil: "networkidle2", timeout: 45000 });
await new Promise((r) => setTimeout(r, 2500));
const s = await page.snapshot({ interactive: true });
({ url: page.url(), snap: String(typeof s === "string" ? s : JSON.stringify(s)).slice(0, 7000) })
