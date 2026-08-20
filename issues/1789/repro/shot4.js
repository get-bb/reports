const page = await browser.getPage("bb1789");
await page.goto("http://localhost:16895/projects/proj_mufw9k2pk4/threads/thr_4ntcmbky7w");
await new Promise(r=>setTimeout(r,12000));
await page.screenshot({path:"/tmp/bb-reports/issues/assets/1789-thread-destroyed-env-queue.png"});
const s = await page.snapshot({ interactive: false });
(typeof s === "string" ? s : JSON.stringify(s)).slice(0,4000)
