const page = await browser.getPage("bb2093");
// Control first: AGENTS.md
await page.click("ref/e310");
await page.type("ref/e310", "AGENTS.md");
await new Promise((r) => setTimeout(r, 2500));
await page.screenshot({ path: "/tmp/bb-reports/issues/assets/2093-file-search-control-agents-md.png" });
const s1 = await page.snapshot({ interactive: true, track: "search" });
// Now the bug: ci.yml
await page.evaluate(() => {});
const box = await page.ref("e310");
await box.click({ clickCount: 3 });
await page.keyboard.press("Backspace");
await page.type("ref/e310", "ci.yml");
await new Promise((r) => setTimeout(r, 2500));
await page.screenshot({ path: "/tmp/bb-reports/issues/assets/2093-file-search-ci-yml-empty.png" });
const s2 = await page.snapshot({ interactive: true, track: "search" });
({ control: s1.full.slice(-1500), bug: s2.full.slice(-1500) });
