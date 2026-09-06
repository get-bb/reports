const page = await browser.getPage("issue-3182");
await page.setViewport({
  width: 740,
  height: 360,
  deviceScaleFactor: 1,
  isMobile: true,
  hasTouch: true,
});
await page.goto("http://localhost:18166");
await page.waitForLoad();
await page.waitForSelector("[data-sidebar='trigger']", { timeout: 15000 });
const state = await page.$eval(
  "[data-sidebar='panel']",
  (element) => element.getAttribute("data-state"),
);
if (state !== "open") {
  await page.click("[data-sidebar='trigger']");
}
await page.waitForSelector("[data-sidebar='panel'][data-state='open']", {
  timeout: 5000,
});
await new Promise((resolve) => setTimeout(resolve, 350));
const result = await page.evaluate(() => {
  const measure = (selector) => {
    const element = document.querySelector(selector);
    if (!(element instanceof HTMLElement)) {
      throw new Error(`Missing ${selector}`);
    }
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return {
      y: rect.y,
      height: rect.height,
      bottom: rect.bottom,
      flexShrink: style.flexShrink,
      overflowY: style.overflowY,
    };
  };
  const navigation = measure("[data-testid='plugin-nav-sidebar-items']");
  const threadContent = measure("[data-sidebar='content']");
  const content = document.querySelector("[data-sidebar='content']");
  const contentRect = content.getBoundingClientRect();
  const visibleThreadRows = [...content.querySelectorAll("a[href*='/threads/']")].filter(
    (element) => {
      const rect = element.getBoundingClientRect();
      return rect.bottom > contentRect.top && rect.top < contentRect.bottom;
    },
  ).length;
  return {
    viewport: { width: innerWidth, height: innerHeight },
    navigation,
    threadContent,
    visibleThreadRows,
  };
});
if (result.threadContent.height >= 120) {
  throw new Error(
    `Expected less than two 60px thread rows, received ${result.threadContent.height}px`,
  );
}
result;
