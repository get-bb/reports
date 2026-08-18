const page = await browser.getPage("main");
await page.setViewportSize({ width: 1400, height: 900 });
await page.goto(`http://localhost:13733/threads/thr_fd5mtx2jfz`, { waitUntil: "networkidle" });
await page.waitForTimeout(4000);
try { await page.getByText(/Worked for/).first().click({ timeout: 3000 }); } catch {}
await page.waitForTimeout(1000);
try { await page.getByText(/Ran tool image_probe/).first().click({ timeout: 3000 }); } catch (e) { console.log("no row", String(e).slice(0,80)); }
await page.waitForTimeout(1500);
console.log(await saveScreenshot(await page.screenshot(), "1762-codex-thread.png"));
