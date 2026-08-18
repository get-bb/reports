// Check other content surfaces on the PR build: thread info panel (directory path), settings page text.
const page = await browser.getPage("bb1440");
await page.evaluate(() => window.getSelection().removeAllRanges());
// open the secondary panel
await page.getByRole("button", { name: /Toggle secondary panel|Toggle right|panel/i }).first().click({ timeout: 3000 }).catch(() => {});
await page.waitForTimeout(800);
const usOf = (t) => page.evaluate((t) => { const el = [...document.querySelectorAll("body *")].find((n) => n.children.length === 0 && n.textContent.trim() === t); return el ? getComputedStyle(el).userSelect + " <" + el.tagName + ">" : "(not found)"; }, t);
console.log("Directory value '/tmp/1440-qa':", await usOf("/tmp/1440-qa"));
console.log("'No local changes relative to main.':", await usOf("No local changes relative to main."));
console.log("Thread title 'Selection QA' (header):", await usOf("Selection QA"));
await saveScreenshot(await page.screenshot(), "1440-pr-info-panel.png");

await page.goto("http://localhost:13365/settings", { waitUntil: "load" });
await page.waitForTimeout(3000);
const settings = await page.evaluate(() => {
  const nodes = [...document.querySelectorAll("main *")].filter((n) => n.children.length === 0 && n.textContent.trim().length > 0);
  const counts = { text: 0, none: 0 };
  const samplesText = [];
  for (const n of nodes) { const u = getComputedStyle(n).userSelect; counts[u] = (counts[u] || 0) + 1; if (u === "text" && samplesText.length < 10) samplesText.push(n.textContent.trim().slice(0, 60)); }
  return { counts, samplesText, sample: nodes.slice(0, 40).map((n) => n.textContent.trim().slice(0, 50)) };
});
console.log("--- /settings leaf text nodes by computed user-select ---");
console.log(JSON.stringify(settings, null, 2));
await saveScreenshot(await page.screenshot(), "1440-pr-settings.png");
