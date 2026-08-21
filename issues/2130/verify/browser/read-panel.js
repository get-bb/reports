// Read the text of the right panel (complementary region) including any shadow roots.
const page = await browser.getPage("v2130");
const result = await page.evaluate(() => {
  const collect = (root) => {
    let out = "";
    const walk = (node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        out += node.textContent + " ";
        return;
      }
      if (node.shadowRoot) walk(node.shadowRoot);
      for (const child of node.childNodes) walk(child);
    };
    walk(root);
    return out.replace(/\s+/g, " ").trim();
  };
  const panel = document.querySelector("[role=complementary]") ?? document.body;
  const hosts = Array.from(document.querySelectorAll("*")).filter((el) => el.shadowRoot);
  return {
    visibility: document.visibilityState,
    panelText: collect(panel).slice(0, 400),
    shadowHosts: hosts.map((h) => h.tagName.toLowerCase()).slice(0, 10),
    docsEditor: Array.from(document.querySelectorAll(".ProseMirror")).map((el) =>
      el.innerText.replace(/\s+/g, " ").trim().slice(0, 300),
    ),
    changedOnDiskBanner: /Changed on disk/.test(document.body.textContent ?? ""),
    time: new Date().toTimeString().slice(0, 8),
  };
});
result;
