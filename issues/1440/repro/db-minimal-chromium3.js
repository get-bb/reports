// Bisect which structural feature makes Select All produce an empty selection.
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
// A: flat, no editable, click on none area
await trial("A flat", `<body style="user-select:none;margin:0"><div style="height:80px">chrome</div><div style="padding:20px 200px">${island}</div></body>`, [300, 40]);
// B: flat + contenteditable
await trial("B flat+editable", `<body style="user-select:none;margin:0"><div style="height:80px">chrome</div><div style="padding:20px 200px">${island}</div><div contenteditable style="user-select:text">x</div></body>`, [300, 40]);
// C: island in overflow:auto container
await trial("C scroll container", `<body style="user-select:none;margin:0"><div style="height:80px">chrome</div><div style="height:200px;overflow:auto"><div style="padding:20px 200px">${island}</div></div></body>`, [300, 40]);
// D: chrome text before island where the click lands in a text-bearing none element
await trial("D click on none text", `<body style="user-select:none;margin:0"><div style="height:80px">chrome label text</div><div style="padding:20px 200px">${island}</div></body>`, [30, 10]);
// E: sidebar layout: click in empty area of a flex nav that has text
await trial("E flex nav", `<body style="user-select:none;margin:0;height:100vh"><div style="display:flex;height:100%"><nav style="width:200px">sidebar label</nav><main style="flex:1"><div style="padding:20px">${island}</div></main></div></body>`, [100, 300]);
// F: E but click inside main empty area
await trial("F flex main empty", `<body style="user-select:none;margin:0;height:100vh"><div style="display:flex;height:100%"><nav style="width:200px">sidebar label</nav><main style="flex:1"><div style="padding:20px">${island}</div></main></div></body>`, [600, 400]);
