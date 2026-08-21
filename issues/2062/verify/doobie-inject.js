const page = await browser.getPage("v2062");
const r = await page.evaluate(() => {
  const btns = Array.from(document.querySelectorAll('[role="dialog"] button')).filter((b) => b.textContent.trim() === "GLM 4.7");
  const b = btns[1];
  const label = b.querySelector("span");
  const before = { btnAlign: getComputedStyle(b).textAlign, labelAlign: getComputedStyle(label).textAlign, labelWidth: label.getBoundingClientRect().width, display: getComputedStyle(label).display };
  const wrap = document.createElement("span");
  wrap.className = "flex min-w-0 flex-1 flex-col gap-0.5";
  b.insertBefore(wrap, label);
  wrap.appendChild(label);
  const desc = document.createElement("span");
  desc.className = "truncate text-subtle-foreground";
  desc.textContent = "openrouter/glm-4.7";
  wrap.appendChild(desc);
  const after = { labelAlign: getComputedStyle(label).textAlign, labelWidth: label.getBoundingClientRect().width, wrapDisplay: getComputedStyle(wrap).display, wrapFlex: getComputedStyle(wrap).flexGrow, descAlign: getComputedStyle(desc).textAlign, labelLeft: label.getBoundingClientRect().left, btnLeft: b.getBoundingClientRect().left };
  return { before, after };
});
await page.screenshot({ path: "/tmp/bb-reports/issues/2062/verify/v-03-injected-pr-dom.png" });
r
