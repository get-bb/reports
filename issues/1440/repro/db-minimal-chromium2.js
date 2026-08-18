// Variant: island inside a nested scroll container in an overflow:hidden shell (like the bb app shell).
const page = await browser.newPage();
await page.setContent(`<!doctype html><html style="height:100%"><body style="user-select:none;margin:0;height:100%;overflow:hidden;font:16px sans-serif">
<div id="root" style="height:100%;display:flex">
 <nav style="width:200px;background:#eee">sidebar label</nav>
 <main style="flex:1;display:flex;flex-direction:column;min-height:0">
  <div style="flex:1;overflow:auto;min-height:0"><div style="padding:20px 200px">
    <div id="island" style="user-select:text;background:#dfd">island content text</div>
    <div>chrome between</div>
    <div class="island" style="user-select:text;background:#dfd">second island</div>
  </div></div>
  <div contenteditable="true" id="ed" style="user-select:text;border:1px solid #999;min-height:40px"></div>
 </main>
</div></body></html>`);
await page.mouse.click(100, 300);
await page.keyboard.press("Control+A");
console.log("SelectAll toString:", JSON.stringify(await page.evaluate(() => getSelection().toString())));
console.log("SelectAll anchors:", JSON.stringify(await page.evaluate(() => { const s = getSelection(); return { a: s.anchorNode && s.anchorNode.nodeName, ao: s.anchorOffset, f: s.focusNode && s.focusNode.nodeName, fo: s.focusOffset }; })));
await page.keyboard.press("Control+C");
await page.click("#ed");
await page.keyboard.press("Control+V");
console.log("SelectAll -> clipboard pasted into contenteditable:", JSON.stringify(await page.evaluate(() => document.getElementById("ed").innerText)));
