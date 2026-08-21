const page = await browser.getPage("bb2130");
const s = await page.snapshot({ interactive: true, track: "p" });
const line = s.full.split("\n").find((l) => /Show right panel/.test(l));
if (line) {
  await page.click("ref/" + line.match(/ref=(e\d+)/)[1]);
  await new Promise((r) => setTimeout(r, 3000));
}
const s2 = await page.snapshot({ interactive: true, track: "p2" });
s2.full.split("\n").filter((l) => /tab|status.txt|outside|Info|Diff/i.test(l)).slice(0, 30);
