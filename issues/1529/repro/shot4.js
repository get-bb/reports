const page = await browser.getPage("bb1529");
await page.setViewportSize({ width: 1400, height: 1000 });
await page.goto("http://localhost:12031/projects/proj_tau8244si4/threads/thr_pvxfiskgsx");
await new Promise((r) => setTimeout(r, 6000));
const info0 = await page.evaluate(() => {
  const el = Array.from(document.querySelectorAll("*")).find((e) => e.children.length === 0 && /^Worked for/.test((e.textContent ?? "").trim()));
  if (!el) return "no worked-for";
  let clickable = el;
  for (let i = 0; i < 6 && clickable; i++) { if (clickable.tagName === "BUTTON" || clickable.getAttribute("role") === "button") break; clickable = clickable.parentElement; }
  (clickable ?? el).click();
  return (clickable ?? el).tagName + " " + (clickable ?? el).textContent.slice(0, 40);
});
console.log("clicked", info0);
await new Promise((r) => setTimeout(r, 2000));
const texts = await page.evaluate(() => Array.from(document.querySelectorAll("*")).filter((e) => e.children.length === 0 && /Ran|exit code|echo alive/.test(e.textContent ?? "")).map((e) => e.textContent.trim().slice(0, 60)));
console.log(JSON.stringify(texts));
const info = await page.evaluate(() => {
  const el = Array.from(document.querySelectorAll("*")).find((e) => e.children.length === 0 && /^Worked for/.test((e.textContent ?? "").trim()));
  if (el) { el.scrollIntoView({ block: "start" }); return "ok"; }
  return null;
});
await new Promise((r) => setTimeout(r, 1200));
console.log(await saveScreenshot(await page.screenshot(), "1529-thread-commands3.png"));
