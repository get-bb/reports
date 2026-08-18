// Click INSIDE the selectable island before Select All.
async function trial(name, html, clickSel) {
  const page = await browser.newPage();
  await page.setContent(html);
  await page.click(clickSel);
  await page.keyboard.press("Control+A");
  const r = await page.evaluate(() => { const s = getSelection(); return { text: s.toString(), a: s.anchorNode && (s.anchorNode.nodeName + ":" + (s.anchorNode.textContent||"").slice(0,15)), ao: s.anchorOffset, f: s.focusNode && (s.focusNode.nodeName + ":" + (s.focusNode.textContent||"").slice(0,15)), fo: s.focusOffset }; });
  console.log(name, JSON.stringify(r));
  await page.close();
}
const island = `<div id="island" style="user-select:text;background:#dfd">island content text</div>`;
const ed = `<div contenteditable style="user-select:text">x</div>`;
await trial("N body none, island, editable; click island", `<body style="user-select:none;margin:0"><div style="height:80px">chrome</div><div style="padding:20px 200px">${island}</div>${ed}</body>`, "#island");
await trial("O body none, island, none text, editable; click island", `<body style="user-select:none;margin:0"><div style="height:80px">chrome</div><div style="padding:20px 200px">${island}</div><div>chrome after</div>${ed}</body>`, "#island");
await trial("P no none at all; content, editable; click content", `<body style="margin:0"><div style="height:80px">chrome</div><div style="padding:20px 200px">${island}</div>${ed}</body>`, "#island");
await trial("Q no none at all; content, editable; click chrome", `<body style="margin:0"><div id="c" style="height:80px">chrome</div><div style="padding:20px 200px">${island}</div>${ed}</body>`, "#c");
await trial("R chrome none only (opt-out approach), click chrome", `<body style="margin:0"><div id="c" style="height:80px;user-select:none">chrome</div><div style="padding:20px 200px">${island}</div><div>trailing text</div>${ed}</body>`, "#c");
await trial("S chrome none only, click island", `<body style="margin:0"><div id="c" style="height:80px;user-select:none">chrome</div><div style="padding:20px 200px">${island}</div><div>trailing text</div>${ed}</body>`, "#island");
await trial("T body none, island, editable, trailing island after editable; click island", `<body style="user-select:none;margin:0"><div style="height:80px">chrome</div><div style="padding:20px 200px">${island}</div>${ed}<div style="user-select:text">tail</div></body>`, "#island");
