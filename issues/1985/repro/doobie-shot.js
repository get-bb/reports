const page = await browser.getPage("bb1985");
await new Promise((r) => setTimeout(r, 4000));
await page.screenshot({ path: "/tmp/bb-reports/issues/assets/1985-bug.png" });
const text = await page.evaluate(() => document.body.innerText);
text.split("\n").filter((l) => /Preview|handbook|pdf/i.test(l)).join("\n");
