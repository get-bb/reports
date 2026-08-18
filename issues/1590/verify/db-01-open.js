// dev-browser script: open the bb thread from a real non-loopback HTTP origin
// and report the browser's secure-context / Clipboard API state.
const page = await browser.getPage("lan");
await page.setViewportSize({ width: 1280, height: 800 });
await page.goto("http://192.168.4.29:26934/thread/thr_3q88fks8ry", {
  waitUntil: "load",
  timeout: 30000,
});
await page.waitForTimeout(5000);
console.log(
  JSON.stringify(
    await page.evaluate(() => ({
      origin: location.origin,
      isSecureContext: window.isSecureContext,
      navigatorClipboard: typeof navigator.clipboard,
      writeText: typeof (navigator.clipboard && navigator.clipboard.writeText),
      execCommand: typeof document.execCommand,
      ua: navigator.userAgent,
    })),
  ),
);
console.log(page.url());
