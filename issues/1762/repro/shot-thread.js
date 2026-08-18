const shots = [
  ["thr_6z8fjkedm8", "1762-claude-code-thread.png"],
  ["thr_x28s7iri25", "1762-pi-thread.png"],
  ["thr_fd5mtx2jfz", "1762-codex-thread.png"],
];
const page = await browser.getPage("main");
await page.setViewportSize({ width: 1400, height: 900 });
for (const [tid, name] of shots) {
  await page.goto(`http://localhost:13733/threads/${tid}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(4000);
  const worked = page.getByText(/Worked for/).first();
  try { await worked.click({ timeout: 3000 }); } catch (e) { console.log("no Worked for:", String(e).slice(0, 80)); }
  await page.waitForTimeout(1000);
  const probe = page.getByText(/image_probe/).nth(0);
  // click any tool row mentioning image_probe inside the main pane
  const rows = await page.locator("main").getByText(/image_probe/).all();
  for (const r of rows) { try { await r.click({ timeout: 800 }); } catch {} }
  await page.waitForTimeout(1500);
  console.log(name, await saveScreenshot(await page.screenshot(), name));
}
