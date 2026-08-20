const page = await browser.getPage("bb1789");
await new Promise(r=>setTimeout(r,15000));
await page.screenshot({path:"/tmp/bb-reports/issues/assets/1789-thread-destroyed-env-queue.png"});
(await page.snapshot({ interactive: false })).full.slice(0,3000)
