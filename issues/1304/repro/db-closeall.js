const pages = await browser.listPages();
for (const p of pages) { if (p.name) { await browser.closePage(p.name); console.log("closed", p.name); } }
console.log("remaining", JSON.stringify(await browser.listPages()));
