// Prints the text rendered by the active file preview (the code view lives in a
// <diffs-container> shadow root), plus document visibility, so we can tell
// whether the open view tracked the disk without touching focus/visibility.
const page = await browser.getPage("v2130");
const result = await page.evaluate(() => {
  const hosts = Array.from(document.querySelectorAll("diffs-container"));
  const texts = hosts.map((h) =>
    h.shadowRoot.textContent.replace(/\s+/g, " ").trim().slice(0, 300),
  );
  // Docs plugin editor (tiptap) renders into a ProseMirror contenteditable.
  const pm = Array.from(document.querySelectorAll(".ProseMirror")).map((el) =>
    el.innerText.replace(/\s+/g, " ").trim().slice(0, 300),
  );
  const banners = Array.from(document.querySelectorAll("div"))
    .map((d) => d.textContent)
    .filter((t) => /Changed on disk/.test(t ?? ""))
    .length;
  return {
    visibility: document.visibilityState,
    codeView: texts,
    docsEditor: pm,
    changedOnDiskBanner: banners > 0,
    time: new Date().toTimeString().slice(0, 8),
  };
});
result;
