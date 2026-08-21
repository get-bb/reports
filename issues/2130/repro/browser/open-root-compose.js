const page = await browser.getPage("bb2130");
await page.goto("http://localhost:15170/projects/proj_sy4khgnq6z/new");
await new Promise((r) => setTimeout(r, 5000));
const s = await page.snapshot({ interactive: true, track: "root" });
({ url: page.url(), lines: s.full.split("\n").filter((l) => /panel|tab|search|file/i.test(l)).slice(0, 40) });
