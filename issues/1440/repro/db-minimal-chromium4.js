// More bisecting around the contenteditable interaction.
async function trial(name, html, clickAt) {
  const page = await browser.newPage();
  await page.setContent(html);
  await page.mouse.click(clickAt[0], clickAt[1]);
  await page.keyboard.press("Control+A");
  const r = await page.evaluate(() => { const s = getSelection(); return { text: s.toString(), a: s.anchorNode && (s.anchorNode.nodeName + ":" + (s.anchorNode.textContent||"").slice(0,15)), ao: s.anchorOffset, f: s.focusNode && (s.focusNode.nodeName + ":" + (s.focusNode.textContent||"").slice(0,15)), fo: s.focusOffset }; });
  console.log(name, JSON.stringify(r));
  await page.close();
}
const island = `<div id="island" style="user-select:text;background:#dfd">island content text</div>`;
const ed = `<div contenteditable style="user-select:text">x</div>`;
await trial("G island, none-text, editable", `<body style="user-select:none;margin:0"><div style="height:80px">chrome</div><div style="padding:20px 200px">${island}</div><div>chrome after</div>${ed}</body>`, [300, 40]);
await trial("H no body-none: nav none, content text, editable after", `<body style="margin:0"><div style="height:80px;user-select:none">chrome</div><div style="padding:20px 200px">${island}</div>${ed}</body>`, [300, 40]);
await trial("I body none, editable wrapper text", `<body style="user-select:none;margin:0"><div style="height:80px">chrome</div><div style="padding:20px 200px">${island}</div><div style="user-select:text">${ed}</div></body>`, [300, 40]);
await trial("J editable before island", `<body style="user-select:none;margin:0"><div style="height:80px">chrome</div>${ed}<div style="padding:20px 200px">${island}</div></body>`, [300, 40]);
await trial("K textarea after island", `<body style="user-select:none;margin:0"><div style="height:80px">chrome</div><div style="padding:20px 200px">${island}</div><textarea style="user-select:text"></textarea></body>`, [300, 40]);
await trial("L island then trailing selectable text then editable", `<body style="user-select:none;margin:0"><div style="height:80px">chrome</div><div style="padding:20px 200px">${island}</div><span style="user-select:text"> </span>${ed}</body>`, [300, 40]);
await trial("M editable with user-select:contain wrapper", `<body style="user-select:none;margin:0"><div style="height:80px">chrome</div><div style="padding:20px 200px">${island}</div><div style="user-select:contain">${ed}</div></body>`, [300, 40]);
