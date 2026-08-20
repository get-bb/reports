const page = await browser.getPage("bb2029");
await page.setViewport({ width: 1280, height: 1300 });
await page.goto("http://localhost:11347/extensions/plugins?view=installed");
await new Promise((r) => setTimeout(r, 8000));
await page.evaluate(() => {
  const el = [...document.querySelectorAll("*")].find((e) => e.textContent === "Collab fixture");
  if (el) el.scrollIntoView({ block: "center" });
});
await new Promise((r) => setTimeout(r, 1000));
await page.screenshot({ path: "/tmp/bb-reports/issues/assets/2029-plugins-page.png", fullPage: false });
({ url: page.url(), title: await page.title() });
