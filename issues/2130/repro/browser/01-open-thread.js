const page = await browser.getPage("bb2130");
await page.setViewport({ width: 1400, height: 900 });
await page.goto("http://localhost:15170/projects/proj_sy4khgnq6z/threads/thr_qdnvnfqkvh");
await new Promise((r) => setTimeout(r, 5000));
const s = await page.snapshot({ interactive: true, track: "main" });
({ url: page.url(), title: await page.title(), snap: s.full.slice(0, 5000) });
