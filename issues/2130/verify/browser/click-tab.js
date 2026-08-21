// Click the panel tab whose accessible name contains TAB_NAME (edit below).
const TAB_NAME = "queue.txt";
const page = await browser.getPage("v2130");
await new Promise((r) => setTimeout(r, 1500));
const s = await page.snapshot({ interactive: true, track: "tabs" });
const line = s.full.split("\n").find((l) => l.includes(TAB_NAME) && l.includes("ref="));
if (!line) throw new Error("tab not found: " + s.full.slice(0, 3000));
const ref = line.match(/ref=(e\d+)/)[1];
await page.click("ref/" + ref);
await new Promise((r) => setTimeout(r, 2500));
({ clicked: line.trim() });
