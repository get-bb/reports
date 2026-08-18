// More PR probes: Ctrl+A after clicking in a message; tool output block; thread info panel; settings page.
const page = await browser.getPage("bb1440");
await page.setViewportSize({ width: 1400, height: 900 });
await page.goto("http://localhost:13365/projects/proj_xp7gwkuyi4/threads/thr_2wxsqrnrwx", { waitUntil: "load" });
await page.waitForTimeout(6000);
console.log(await page.evaluate(() => document.querySelector("main").innerText.slice(0, 800)));

// Ctrl+A after clicking inside message text
await page.evaluate(() => window.getSelection().removeAllRanges());
const box = await page.evaluate(() => {
  const el = [...document.querySelectorAll("body *")].find((n) => n.children.length === 0 && n.textContent.trim().startsWith("Run the shell command"));
  const r = el.getBoundingClientRect();
  return { x: r.x, y: r.y, w: r.width, h: r.height };
});
await page.mouse.click(box.x + 10, box.y + box.h / 2);
await page.keyboard.press("Control+A");
await page.waitForTimeout(200);
console.log("--- Ctrl+A after clicking inside a user message ---");
console.log(JSON.stringify(await page.evaluate(() => window.getSelection().toString())));
await saveScreenshot(await page.screenshot(), "1440-pr-select-all-from-message.png");
await page.evaluate(() => window.getSelection().removeAllRanges());

// expand tool call rows: click anything containing 'echo hello-1440' that is a button
const toolRows = await page.evaluate(() => {
  return [...document.querySelectorAll("main *")]
    .filter((n) => n.children.length === 0 && /hello-1440|README|cat /.test(n.textContent))
    .map((n) => ({ tag: n.tagName, text: n.textContent.slice(0, 80), us: getComputedStyle(n).userSelect, inButton: !!n.closest("button") }));
});
console.log("--- elements mentioning the command ---");
console.log(JSON.stringify(toolRows, null, 2));
