// Issue #1676 item 1b: switching sidebar views in Tasks (Active -> All tasks)
// paints the previous view's emptiness as the new view's "No tasks yet".
// Precondition: delay.json = {"match":"rpc/listTasks","ms":3000} so the
// refetch window is wide enough to screenshot.
const page = await browser.getPage("bb");
await page.setViewportSize({width: 1280, height: 800});
await page.goto("http://localhost:12312/plugins/tasks/tasks", {waitUntil: "commit"});
await page.waitForTimeout(12000);
const mainText = async () => (await page.evaluate("(document.querySelector('main')?.innerText || '').replace(/[ \\n\\t]+/g, ' ').slice(0, 160)"));
console.log("ALL (settled):", await mainText());
await page.getByRole("link", { name: /^Active/ }).first().click({ timeout: 5000 }).catch(async () => {
  await page.getByText("Active", { exact: true }).first().click({ timeout: 5000 });
});
await page.waitForTimeout(8000);
console.log("ACTIVE (settled):", await mainText());
await saveScreenshot(await page.screenshot(), "1676-tasks-active-settled.png");
// sample main text right after clicking All tasks
await page.evaluate(`window.__samples = []; window.__t0 = performance.now(); setInterval(() => {
  const s = (document.querySelector('main')?.innerText || '').replace(/[ \\n\\t]+/g, ' ').slice(0, 160);
  if (!window.__samples.length || window.__samples[window.__samples.length - 1].s !== s) window.__samples.push({t: Math.round(performance.now() - window.__t0), s});
}, 8);`);
await page.getByRole("link", { name: /^All tasks/ }).first().click({ timeout: 5000 }).catch(async () => {
  await page.getByText("All tasks", { exact: true }).first().click({ timeout: 5000 });
});
await page.waitForTimeout(800);
console.log(await saveScreenshot(await page.screenshot(), "1676-tasks-all-after-active-early.png"));
await page.waitForTimeout(8000);
console.log(await saveScreenshot(await page.screenshot(), "1676-tasks-all-after-active-settled.png"));
console.log(JSON.stringify(await page.evaluate("window.__samples"), null, 1));
