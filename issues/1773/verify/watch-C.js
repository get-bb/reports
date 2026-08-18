// dev-browser script: reload the thread page, then poll the right-panel tab
// strip every 150 ms while an external `bb thread open <id> README.md` runs.
// Records the tab strip labels over time, the toast text, and /tabs traffic.
const page = await browser.getPage("main");
await page.setViewportSize({ width: 1400, height: 900 });
const reqs = [];
page.on("response", async (r) => {
  if (r.url().includes("/tabs")) {
    reqs.push(
      Date.now() + " " + r.request().method() + " " + r.url() + " => " + r.status(),
    );
  }
});
await page.goto(
  "http://localhost:12702/projects/proj_8q7r7ymyyp/threads/thr_ndvdqterge",
);
await page.waitForTimeout(6000);
await writeFile("1773-ready", "ready");
const timeline = [];
let toastText = "";
let shotTaken = false;
const t0 = Date.now();
for (let i = 0; i < 100; i++) {
  await page.waitForTimeout(150);
  const strip = await page
    .locator("[data-tab-pill-close]")
    .evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));
  const hasDocs = (await page.locator("text=Original").count()) > 0;
  const entry = (Date.now() - t0) + "ms strip=" + JSON.stringify(strip.filter(Boolean)) + " docsOriginalToggle=" + hasDocs;
  if (timeline[timeline.length - 1]?.split(" ").slice(1).join(" ") !== entry.split(" ").slice(1).join(" ")) {
    timeline.push(entry);
  }
  if (hasDocs && !shotTaken) {
    shotTaken = true;
    await saveScreenshot(await page.screenshot(), "1773-verify-docs-open.png");
  }
  const t = await page.locator("[data-sonner-toast]").allInnerTexts();
  if (t.length > 0 && t.join("").trim() !== "" && toastText === "") {
    toastText = t.join("\n---\n");
    await saveScreenshot(await page.screenshot(), "1773-verify-toast-C.png");
  }
}
console.log("TIMELINE:\n" + timeline.join("\n"));
console.log("TOAST:", JSON.stringify(toastText));
console.log("REQS:\n" + reqs.join("\n"));
await saveScreenshot(await page.screenshot(), "1773-verify-final-C.png");
