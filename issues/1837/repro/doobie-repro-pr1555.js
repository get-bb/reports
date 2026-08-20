// Repro for get-bb/bb#1837 against a dev bb instance.
// Holds the inline-vis `prepareHtmlPreview` RPC so the loading state is visible,
// measures the directive box and the composer position, then releases the RPC
// and measures again. A layout jump shows as a different box height / composer
// offset between the two measurements.
const URL = "http://localhost:16414/projects/proj_zwnmd5uykh/threads/thr_yepw5sn448";
const page = await browser.getPage("bb1837");
await page.setViewport({ width: 1100, height: 900 });

let release = null;
const held = new Promise((r) => (release = r));
await page.setRequestInterception(true);
const onReq = async (req) => {
  if (req.url().includes("/rpc/prepareHtmlPreview")) {
    await held; // hold the RPC until we have measured the loading state
  }
  req.continue().catch(() => {});
};
page.on("request", onReq);

await page.goto(URL);
await page.waitForSelector('[aria-busy="true"][class*="my-2"]', { timeout: 30000 });
await new Promise((r) => setTimeout(r, 1200));

const measure = () =>
  page.evaluate(() => {
    const box =
      document.querySelector('[aria-busy="true"][class*="my-2"]') ??
      document.querySelector("iframe[title^='inline-vis']")?.parentElement;
    const r = box.getBoundingClientRect();
    const textarea = document.querySelector("textarea");
    const t = textarea ? textarea.getBoundingClientRect() : null;
    // Element directly after the directive in document order (anything below it shifts)
    const scroller = box.closest("[data-radix-scroll-area-viewport], main") ?? document.scrollingElement;
    return {
      state: box.getAttribute("aria-busy") === "true" ? "loading" : "ready",
      boxTop: Math.round(r.top),
      boxHeight: Math.round(r.height),
      boxText: box.innerText.slice(0, 80),
      scrollHeight: scroller.scrollHeight,
      shimmer: Array.from(document.querySelectorAll("[data-inline-vis-skeleton-shimmer]")).slice(0,1).map((el) => {
        const cs = getComputedStyle(el);
        return { animationName: cs.animationName, playState: cs.animationPlayState, ariaHiddenAncestor: el.closest('[aria-hidden="true"]') !== null };
      }),
    };
  });

const before = await measure();
await page.screenshot({ path: "/tmp/bb-reports/issues/assets/1837-pr1555-loading.png" });

release();
await page.waitForSelector("iframe[title^='inline-vis']", { timeout: 30000 });
await new Promise((r) => setTimeout(r, 1500));
const after = await measure();
await page.screenshot({ path: "/tmp/bb-reports/issues/assets/1837-pr1555-loaded.png" });

page.off("request", onReq);
await page.setRequestInterception(false);
({ before, after, deltaHeight: after.boxHeight - before.boxHeight });
