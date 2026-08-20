// Open the source acp-cursor thread, hover its user message so the message
// action bar reveals, hover the "Fork into new thread" button to show the
// tooltip, and screenshot. This proves the app offers fork for a cursor thread.
const page = await browser.getPage("bb1833");
await page.setViewport({ width: 1400, height: 900 });
await page.goto(
  "http://localhost:14875/projects/proj_thd6gcvyyy/threads/thr_7wvkgmjn97",
);
await page.waitForFunction(() => document.body.innerText.includes("ok"), {
  timeout: 40000,
});
await new Promise((r) => setTimeout(r, 1500));
// Hover the user message bubble.
const handle = await page.evaluateHandle(() => {
  const els = [...document.querySelectorAll("div,p,span")];
  return els.find((el) => el.textContent?.trim() === "Reply only with ok." && el.closest("main"));
});
await handle.hover();
await new Promise((r) => setTimeout(r, 600));
await page.waitForSelector('button[aria-label="Fork into new thread"]', { timeout: 10000 });
await page.hover('button[aria-label="Fork into new thread"]');
await new Promise((r) => setTimeout(r, 900));
await page.screenshot({
  path: "/tmp/bb-reports/issues/assets/1833-source-thread-fork-action.png",
});
const btn = await page.$('button[aria-label="Fork into new thread"]');
({ forkButtonPresent: !!btn, disabled: await btn?.evaluate((b) => b.disabled) });
