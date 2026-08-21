const page = await browser.getPage("v2093");
await page.evaluate(() => {
  const el = document.activeElement;
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
  setter.call(el, "");
  el.dispatchEvent(new Event("input", { bubbles: true }));
});
await page.type("ref/e278", "ci.yml");
await new Promise((r) => setTimeout(r, 2500));
await page.screenshot({ path: "/tmp/bb-reports/issues/2093/verify/ui-search-ci-yml.png" });
const snap = await page.snapshot({ interactive: true });
const s = typeof snap === "string" ? snap : JSON.stringify(snap);
s.slice(s.indexOf("Search files"), s.indexOf("Search files") + 600);
