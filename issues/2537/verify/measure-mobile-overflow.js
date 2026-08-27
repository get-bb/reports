// Independent verifier copy of the report's saved browser reproduction.
const threadUrl =
  "http://localhost:13938/projects/proj_49a4ergny7/threads/thr_nriu5y82ji";

const page = await browser.getPage("issue-2537-verify");
await page.setViewport({
  width: 362,
  height: 390,
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
});
await page.goto(threadUrl, {
  waitUntil: "domcontentloaded",
  timeout: 3_000,
}).catch(() => null);
await page.waitForSelector("text/4 questions", {
  visible: true,
  timeout: 10_000,
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
    next: { left: nextRect.left, right: nextRect.right },
  };
});

console.log(JSON.stringify(result, null, 2));
const horizontalOverflow = result.banner.right > result.viewport.width;
const hiddenHeading = result.heading.top < 48;
if (horizontalOverflow && hiddenHeading) {
  throw new Error(
    "REPRODUCED: the card exceeds the viewport and the app header hides the form heading.",
  );
}
({ status: "NOT REPRODUCED", result });
