const page = await browser.getPage("bb2019");
await page.evaluate(() => {
  const els = [...document.querySelectorAll('*')].filter(e => e.scrollHeight > e.clientHeight + 50 && getComputedStyle(e).overflowY !== 'visible');
  for (const e of els) e.scrollTop = 0;
  window.scrollTo(0, 0);
});
await new Promise(r => setTimeout(r, 1500));
await page.screenshot({ path: "/tmp/bb-reports/issues/assets/2019-loaded-session-edit-applied.png" });
page.url()
