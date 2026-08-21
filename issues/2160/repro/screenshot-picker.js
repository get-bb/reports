const page = await browser.getPage("bb2160");
const snap = await page.snapshot({ interactive: true });
const line = snap.split("\n").find((l) => l.includes("Grok 4.6"));
const ref = line && line.match(/ref\/e\d+/)?.[0];
if (ref) {
  await page.click(ref);
  await new Promise((r) => setTimeout(r, 1500));
}
await page.screenshot({ path: "/tmp/bb-reports/issues/assets/2160-model-picker.png", fullPage: false });
({ line, ref });
