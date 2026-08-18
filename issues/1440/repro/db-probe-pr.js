// Probe the PR #1428 build: Ctrl+A from the shell, drag across sidebar, computed user-select on
// representative content/chrome elements, drag from timeline gutter into message text.
const page = await browser.getPage("bb1440");
await page.setViewportSize({ width: 1400, height: 900 });
await page.goto("http://localhost:13365/projects/proj_xp7gwkuyi4/threads/thr_2wxsqrnrwx", { waitUntil: "load" });
await page.waitForTimeout(6000);
await page.evaluate(() => window.getSelection().removeAllRanges());
await page.mouse.click(150, 500);
await page.keyboard.press("Control+A");
await page.waitForTimeout(300);
const sel = await page.evaluate(() => window.getSelection().toString());
console.log("--- Ctrl+A from empty sidebar space ---");
console.log(JSON.stringify(sel));
await saveScreenshot(await page.screenshot(), "1440-pr-select-all.png");

await page.evaluate(() => window.getSelection().removeAllRanges());
await page.mouse.move(200, 420);
await page.mouse.down();
await page.mouse.move(60, 160, { steps: 10 });
await page.mouse.move(30, 60, { steps: 6 });
await page.mouse.up();
console.log("--- drag across sidebar ---");
console.log(JSON.stringify(await page.evaluate(() => window.getSelection().toString())));

// computed user-select of representative elements
const probe = await page.evaluate(() => {
  const findText = (t) => [...document.querySelectorAll("body *")].find((n) => n.children.length === 0 && n.textContent.trim() === t);
  const us = (el) => (el ? getComputedStyle(el).userSelect : "(not found)");
  const out = {};
  out.body = us(document.body);
  out["sidebar 'New thread' label"] = us(findText("New thread"));
  out["thread title header"] = us(findText("Selection QA"));
  out["user message text"] = us(findText("Run the shell command: echo hello-1440. Then reply only with ok."));
  out["assistant 'ok'"] = us(findText("ok"));
  out["'Provisioned thread' system row"] = us(findText("Provisioned thread"));
  out["'Worked for' label"] = us(findText("Worked for"));
  out["prompt editor (contenteditable)"] = us(document.querySelector('[contenteditable="true"]'));
  out["footer 'main' branch label"] = us(findText("main"));
  return out;
});
console.log("--- computed user-select ---");
console.log(JSON.stringify(probe, null, 2));

// drag from the empty gutter left of the user message into the message text
await page.evaluate(() => window.getSelection().removeAllRanges());
const box = await page.evaluate(() => {
  const el = [...document.querySelectorAll("body *")].find((n) => n.children.length === 0 && n.textContent.trim() === "Run the shell command: echo hello-1440. Then reply only with ok.");
  const r = el.getBoundingClientRect();
  return { x: r.x, y: r.y, w: r.width, h: r.height };
});
console.log("message box", JSON.stringify(box));
await page.mouse.move(box.x - 200, box.y + box.h / 2);
await page.mouse.down();
await page.mouse.move(box.x + box.w - 5, box.y + box.h / 2, { steps: 15 });
await page.mouse.up();
console.log("--- drag from gutter (200px left of message) across message text ---");
console.log(JSON.stringify(await page.evaluate(() => window.getSelection().toString())));

// drag starting inside the message text
await page.evaluate(() => window.getSelection().removeAllRanges());
await page.mouse.move(box.x + 5, box.y + box.h / 2);
await page.mouse.down();
await page.mouse.move(box.x + box.w - 5, box.y + box.h / 2, { steps: 15 });
await page.mouse.up();
console.log("--- drag starting inside message text ---");
console.log(JSON.stringify(await page.evaluate(() => window.getSelection().toString())));

// drag from user message down through 'ok' (multi-island)
await page.evaluate(() => window.getSelection().removeAllRanges());
const okBox = await page.evaluate(() => {
  const el = [...document.querySelectorAll("body *")].find((n) => n.children.length === 0 && n.textContent.trim() === "ok");
  const r = el.getBoundingClientRect();
  return { x: r.x, y: r.y, w: r.width, h: r.height };
});
await page.mouse.move(box.x + 5, box.y + box.h / 2);
await page.mouse.down();
await page.mouse.move(okBox.x + okBox.w, okBox.y + okBox.h / 2, { steps: 20 });
await page.mouse.up();
console.log("--- drag from message text down to 'ok' ---");
console.log(JSON.stringify(await page.evaluate(() => window.getSelection().toString())));
await saveScreenshot(await page.screenshot(), "1440-pr-drag-messages.png");

// Ctrl+A inside prompt editor after typing
await page.evaluate(() => window.getSelection().removeAllRanges());
await page.click('[contenteditable="true"]');
await page.keyboard.type("draft text");
await page.keyboard.press("Control+A");
await page.waitForTimeout(200);
console.log("--- Ctrl+A inside prompt editor ---");
console.log(JSON.stringify(await page.evaluate(() => window.getSelection().toString())));
await page.keyboard.press("Delete");
