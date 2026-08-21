// Go to the New-thread view for project qa, open the right panel, open a tab, search "status" and open status.txt.
const page = await browser.getPage("v2130");
await page.goto("http://localhost:15982/projects/proj_e7ihe7ux2m/new");
await new Promise((r) => setTimeout(r, 6000));
let s = await page.snapshot({ interactive: true, track: "r1" });
let line = s.full.split("\n").find((l) => /Show right panel/.test(l));
if (line) {
  await page.click("ref/" + line.match(/ref=(e\d+)/)[1]);
  await new Promise((r) => setTimeout(r, 2500));
}
s = await page.snapshot({ interactive: true, track: "r2" });
line = s.full.split("\n").find((l) => /Open new tab/.test(l) && /ref=/.test(l));
if (line) {
  await page.click("ref/" + line.match(/ref=(e\d+)/)[1]);
  await new Promise((r) => setTimeout(r, 2500));
}
s = await page.snapshot({ interactive: true, track: "r3" });
line = s.full.split("\n").find((l) => /Search files/.test(l) && /ref=/.test(l));
if (!line) throw new Error("no search box: " + s.full.split("\n").filter((l) => /tab|search|file|panel/i.test(l)).join("\n"));
await page.click("ref/" + line.match(/ref=(e\d+)/)[1]);
await page.type("ref/" + line.match(/ref=(e\d+)/)[1], "status");
await new Promise((r) => setTimeout(r, 2500));
s = await page.snapshot({ interactive: true, track: "r4" });
line = s.full.split("\n").find((l) => /option/.test(l) && /status\.txt/.test(l));
if (!line) throw new Error("no result: " + s.full.split("\n").filter((l) => /option|status/.test(l)).join("\n"));
await page.click("ref/" + line.match(/ref=(e\d+)/)[1]);
await new Promise((r) => setTimeout(r, 3500));
s = await page.snapshot({ interactive: true, track: "r5" });
({ url: page.url(), lines: s.full.split("\n").filter((l) => /status|tab|Refresh/i.test(l)).slice(0, 20) });
