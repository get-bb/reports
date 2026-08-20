const page = await browser.getPage("v1985");
await new Promise((r) => setTimeout(r, 4000));
await page.screenshot({ path: "/tmp/bb-reports/issues/1985/verify/bug.png" });
const text = await page.evaluate(() => document.body.innerText);
text.split("\n").filter((l) => /Preview|handbook|pdf/i.test(l)).join("\n");
