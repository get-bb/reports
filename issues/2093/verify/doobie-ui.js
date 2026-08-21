// Verifier: follow report section 4b step 6 literally (open thread, Cmd+J, Cmd+T, type in "Search files").
const page = await browser.getPage("v2093");
await page.setViewport({ width: 1400, height: 900 });
await page.goto("http://localhost:13321/projects/proj_54rzdj56ie/threads/thr_hp99fuxvrk");
await new Promise((r) => setTimeout(r, 8000));
let snap = await page.snapshot({ interactive: true });
let s = typeof snap === "string" ? snap : JSON.stringify(snap);
const out = { afterLoad: s.slice(s.indexOf("- main"), s.indexOf("- main") + 1500) };
await page.keyboard.down("Meta"); await page.keyboard.press("KeyJ"); await page.keyboard.up("Meta");
await new Promise((r) => setTimeout(r, 1500));
await page.keyboard.down("Meta"); await page.keyboard.press("KeyT"); await page.keyboard.up("Meta");
await new Promise((r) => setTimeout(r, 1500));
snap = await page.snapshot({ interactive: true });
s = typeof snap === "string" ? snap : JSON.stringify(snap);
out.afterShortcuts = s.slice(-2500);
out;
