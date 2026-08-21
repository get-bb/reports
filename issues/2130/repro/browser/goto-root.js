const page = await browser.getPage("bb2130");
await page.goto("http://localhost:15170/");
await new Promise((r) => setTimeout(r, 5000));
const s = await page.snapshot({ interactive: true, track: "gr" });
({ url: page.url(), lines: s.full.split("\n").filter((l) => /status\.txt|New tab|project/i.test(l)).slice(0, 12) });
