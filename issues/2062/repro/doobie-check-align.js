const page = await browser.getPage("bb2062");
const info = await page.evaluate(() => {
  const btn = Array.from(document.querySelectorAll('[role="dialog"] button')).find((b) => /^Low$/.test(b.textContent || ""));
  if (!btn) return "no Low row";
  const wrapper = btn.firstElementChild;
  const label = wrapper.firstElementChild;
  const cs = (el) => getComputedStyle(el);
  return {
    buttonTextAlign: cs(btn).textAlign,
    wrapperClass: wrapper.className,
    wrapperWidth: wrapper.getBoundingClientRect().width,
    labelTextAlign: cs(label).textAlign,
    labelLeft: label.getBoundingClientRect().left - btn.getBoundingClientRect().left,
    labelDisplay: cs(label).display,
  };
});
info
