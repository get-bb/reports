const page = await browser.getPage("v2130");
await page.setViewport({ width: 1400, height: 900 });
await page.goto("http://localhost:15982/projects/proj_e7ihe7ux2m/threads/thr_c4bypfaiwi");
await new Promise((r) => setTimeout(r, 6000));
const s = await page.snapshot({ interactive: true, track: "main" });
({ url: page.url(), title: await page.title(), snap: s.full.slice(0, 4000) });
