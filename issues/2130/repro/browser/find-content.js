const page = await browser.getPage("bb2130");
await new Promise((r) => setTimeout(r, 2500));
const info = await page.evaluate(() => {
  const hits = [];
  const walk = (root, depth) => {
    for (const el of root.querySelectorAll("*")) {
      if (el.shadowRoot) {
        hits.push({ tag: el.tagName, depth, text: el.shadowRoot.textContent.slice(0, 200) });
        walk(el.shadowRoot, depth + 1);
      }
    }
  };
  walk(document, 0);
  const textHits = [];
  const it = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = it.nextNode())) {
    if (/version/i.test(n.textContent)) {
      textHits.push({ text: n.textContent.slice(0, 100), parent: n.parentElement?.tagName, cls: n.parentElement?.className?.toString().slice(0, 80) });
    }
  }
  return { shadowHosts: hits.slice(0, 10), textHits: textHits.slice(0, 10), visibility: document.visibilityState };
});
info;
