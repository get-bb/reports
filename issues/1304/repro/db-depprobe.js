// dev-browser script: with the dep-identity probe patched into ThreadDetailView
// (see instrumentation-depprobe.diff), type into the composer and report which
// dependency of handleOpenTimelinePluginPanel changed identity across renders.
const CFG = JSON.parse(await readFile("1304-cfg.json"));
const page = await browser.getPage(CFG.pageName);
await page.goto(CFG.url, { waitUntil: "load" });
await page.waitForTimeout(8000);
const editor = page.locator('[contenteditable="true"][role="textbox"]').last();
await editor.click();
await page.waitForTimeout(500);
await page.evaluate(() => { window.__bbDepChanges = {}; window.__bbRenderCounts = {}; });
for (const ch of CFG.text) { await page.keyboard.type(ch); await page.waitForTimeout(25); }
await page.waitForTimeout(500);
console.log(JSON.stringify(await page.evaluate(() => ({ dep: window.__bbDepChanges, renders: window.__bbRenderCounts }))));
