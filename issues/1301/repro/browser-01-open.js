// dev-browser script: open the seeded 9,001-event thread at a 390x844 viewport
// and record the initial DOM size.
const page = await browser.getPage("thread");
await page.setViewportSize({ width: 390, height: 844 });
await page.goto("http://localhost:13028/projects/proj_mgvp7iamvh/threads/thr_wfjb5qctw4", { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(3000);
const info = await page.evaluate(() => {
  const rows = document.querySelectorAll("[data-timeline-row-id]").length;
  const nodes = document.getElementsByTagName("*").length;
  const scrollers = Array.from(document.querySelectorAll("*")).filter(e => { const s = getComputedStyle(e); return (s.overflowY==="auto"||s.overflowY==="scroll") && e.scrollHeight > e.clientHeight + 10; }).map(e => ({tag:e.tagName, cls:e.className.toString().slice(0,80), sh:e.scrollHeight, ch:e.clientHeight, st:e.scrollTop}));
  return { rows, nodes, scrollers, url: location.href };
});
console.log(JSON.stringify(info, null, 2));
const shot = await page.screenshot();
console.log(await saveScreenshot(shot, "1301-initial.png"));
