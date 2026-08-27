// Run with: doobie -b issue2537-revise --headless --timeout 60 run measure-mobile-overflow.js
// Set this URL to the thread that contains the pending form.
const threadUrl =
  "http://localhost:14456/projects/proj_rftsbtzc27/threads/thr_bb6wm784dy";

const page = await browser.getPage("issue-2537-repro");
await page.setViewport({
  width: 362,
  height: 390,
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
});
await page.goto(threadUrl, {
  waitUntil: "domcontentloaded",
  timeout: 30_000,
});
await page.waitForSelector("text/4 questions", {
  visible: true,
  timeout: 30_000,
});

const result = await page.evaluate(() => {
  const banner = document.querySelector('[data-testid="plugin-request-banner"]');
  const heading = [...document.querySelectorAll("h3")].find(
    (element) => element.textContent?.trim() === "4 questions",
  );
  const next = [...document.querySelectorAll("button")].find(
    (element) => element.textContent?.trim() === "Next",
  );
  if (!banner || !heading || !next) {
    throw new Error("The pending question form is not present.");
  }
  const bannerRect = banner.getBoundingClientRect();
  const headingRect = heading.getBoundingClientRect();
  const nextRect = next.getBoundingClientRect();
  return {
    viewport: { width: innerWidth, height: innerHeight },
    banner: {
      left: bannerRect.left,
      right: bannerRect.right,
      width: bannerRect.width,
    },
    heading: { top: headingRect.top, bottom: headingRect.bottom },
    next: {
      left: nextRect.left,
      right: nextRect.right,
      top: nextRect.top,
      bottom: nextRect.bottom,
    },
  };
});

console.log(JSON.stringify(result, null, 2));
const failures = [];
if (result.banner.left < 0) {
  failures.push(`banner.left ${result.banner.left} is less than 0`);
}
if (result.banner.right > result.viewport.width) {
  failures.push(
    `banner.right ${result.banner.right} exceeds viewport.width ${result.viewport.width}`,
  );
}
if (result.heading.top < 48) {
  failures.push(`heading.top ${result.heading.top} is less than app header bottom 48`);
}
if (result.next.right > result.viewport.width) {
  failures.push(
    `next.right ${result.next.right} exceeds viewport.width ${result.viewport.width}`,
  );
}
if (result.next.bottom > result.viewport.height) {
  failures.push(
    `next.bottom ${result.next.bottom} exceeds viewport.height ${result.viewport.height}`,
  );
}
if (failures.length > 0) {
  throw new Error(`LAYOUT ASSERTIONS FAILED:\n${failures.join("\n")}`);
}
({ status: "ALL LAYOUT ASSERTIONS PASSED", result });
