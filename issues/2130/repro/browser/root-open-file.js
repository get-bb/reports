// On the root compose ("New thread") view: pick project qa, open the right
// panel, open a new tab, search for status.txt and open it.
const page = await browser.getPage("bb2130");
const s0 = await page.snapshot({ interactive: true, track: "r0" });
const projLine = s0.full.split("\n").find((l) => /New thread in qa/.test(l) && /ref=/.test(l));
if (projLine) {
  await page.click("ref/" + projLine.match(/ref=(e\d+)/)[1]);
  await new Promise((r) => setTimeout(r, 3000));
}
let s = await page.snapshot({ interactive: true, track: "r1" });
let line = s.full.split("\n").find((l) => /Show right panel/.test(l));
if (line) {
  await page.click("ref/" + line.match(/ref=(e\d+)/)[1]);
  await new Promise((r) => setTimeout(r, 2500));
}
s = await page.snapshot({ interactive: true, track: "r2" });
({ url: page.url(), lines: s.full.split("\n").filter((l) => /tab|search|file|Info|Diff|panel/i.test(l)).slice(0, 40) });
