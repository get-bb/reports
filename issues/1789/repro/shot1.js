const page = await browser.getPage("bb1789");
await page.setViewport({width:1400,height:900});
await page.goto("http://localhost:16895/threads/thr_4ntcmbky7w");
await new Promise(r=>setTimeout(r,6000));
await page.screenshot({path:"/tmp/bb-reports/issues/assets/1789-thread-destroyed-env-queue.png"});
page.url()
