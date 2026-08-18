const page = await browser.getPage("bb1529");
await page.setViewportSize({ width: 1400, height: 1000 });
// page already has "Worked for" expanded from previous script; click "Ran 6 commands"
const r1 = await page.evaluate(() => {
  const el = Array.from(document.querySelectorAll("*")).find((e) => e.children.length === 0 && /^Ran \d+ commands/.test((e.textContent ?? "").trim()));
  if (!el) return "none";
  let clickable = el;
  for (let i = 0; i < 6 && clickable; i++) { if (clickable.tagName === "BUTTON" || clickable.getAttribute("role") === "button") break; clickable = clickable.parentElement; }
  (clickable ?? el).click();
  return (clickable ?? el).tagName;
});
console.log("clicked", r1);
await new Promise((r) => setTimeout(r, 2000));
const texts = await page.evaluate(() => Array.from(document.querySelectorAll("*")).filter((e) => e.children.length === 0 && /Ran |exit code|echo alive|no output/i.test(e.textContent ?? "")).map((e) => e.textContent.trim().slice(0, 60)));
console.log(JSON.stringify(texts));
await page.evaluate(() => {
  const el = Array.from(document.querySelectorAll("*")).find((e) => e.children.length === 0 && /^Ran \d+ commands/.test((e.textContent ?? "").trim()));
  if (el) el.scrollIntoView({ block: "start" });
});
await new Promise((r) => setTimeout(r, 1200));
console.log(await saveScreenshot(await page.screenshot(), "1529-thread-commands4.png"));
