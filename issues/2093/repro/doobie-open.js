const page = await browser.getPage("bb2093");
await page.setViewport({ width: 1400, height: 900 });
await page.goto("http://localhost:14828/projects/proj_2f67zacebv/threads/thr_yiaj6f4f4n");
await new Promise((r) => setTimeout(r, 4000));
const snap = await page.snapshot({ interactive: true, track: "main" });
({ url: page.url(), title: await page.title(), snap: snap.full.slice(0, 7000) });
