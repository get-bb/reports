// First write issue-2394-config.json with doobie's saveFile helper.
// See README.md for the exact command.
const { appUrl, threadId, assetDir } = JSON.parse(
  readFile("issue-2394-config.json"),
);
if (!appUrl) throw new Error("BB_REPORT_APP_URL is required.");
if (!threadId) throw new Error("BB_REPORT_THREAD_ID is required.");

const page = await browser.getPage("issue-2394");
await page.setViewport({ width: 1280, height: 800 });
await page.goto(`${appUrl}/threads/${threadId}`, {
  waitUntil: "domcontentloaded",
  timeout: 15000,
});
await page.waitForSelector("aria/Reply in side chat", {
  visible: true,
  timeout: 15000,
});

const sideChatActions = await page.$$("aria/Reply in side chat");
if (sideChatActions.length === 0) {
  throw new Error("The assistant side-chat action is missing.");
}
await sideChatActions[sideChatActions.length - 1].click();
await page.waitForSelector('[aria-label="Reply…"]', {
  visible: true,
  timeout: 15000,
});

async function resizePanel(widthPx) {
  const resizeHandle = await page.$eval(
    '[aria-label="Resize thread and right panel"]',
    (element) => element.getBoundingClientRect().x,
  );
  await page.mouse.move(resizeHandle, 400);
  await page.mouse.down();
  await page.mouse.move(1280 - widthPx, 400, { steps: 12 });
  await page.mouse.up();
  await new Promise((resolve) => setTimeout(resolve, 500));
}

async function readComposerState() {
  return page.evaluate(() => {
    const editor = document.querySelector('[aria-label="Reply…"]');
    const composer = editor?.closest("[data-follow-up-composer]");
    const trigger = composer?.querySelector(
      'button[aria-label^="Provider, model"]',
    );
    const triggerRect = trigger?.getBoundingClientRect();
    const handleRect = document
      .querySelector('[aria-label="Resize thread and right panel"]')
      ?.getBoundingClientRect();
    return {
      panelWidthPx: handleRect ? Math.round(innerWidth - handleRect.x) : null,
      trigger: triggerRect
        ? {
            x: triggerRect.x,
            y: triggerRect.y,
            width: triggerRect.width,
            height: triggerRect.height,
          }
        : null,
      triggerAriaExpanded: trigger?.getAttribute("aria-expanded") ?? null,
      composerExpanded:
        composer?.hasAttribute("data-follow-up-composer-expanded") ?? false,
      dialogCount: document.querySelectorAll('[role="dialog"]').length,
      activeElement: document.activeElement?.getAttribute("aria-label") ?? null,
    };
  });
}

async function pressModelTrigger() {
  const before = await readComposerState();
  if (before.trigger === null) throw new Error("The model trigger is missing.");
  const { x, y, width, height } = before.trigger;
  await page.mouse.move(x + width / 2, y + height / 2);
  await page.mouse.down();
  await new Promise((resolve) => setTimeout(resolve, 100));
  const duringPress = await readComposerState();
  await page.mouse.up();
  await new Promise((resolve) => setTimeout(resolve, 300));
  const afterRelease = await readComposerState();
  return { before, duringPress, afterRelease };
}

await resizePanel(270);
await page.evaluate(() => {
  const editor = document.querySelector('[aria-label="Reply…"]');
  const composer = editor?.closest("[data-follow-up-composer]");
  if (composer?.hasAttribute("data-follow-up-composer-expanded")) {
    composer
      .querySelector('button[aria-label="Collapse prompt box"]')
      ?.click();
  }
});
await new Promise((resolve) => setTimeout(resolve, 250));
await page.evaluate(() =>
  document.querySelector('[aria-label="Reply…"]')?.focus(),
);
await new Promise((resolve) => setTimeout(resolve, 350));
const narrowPanel = await pressModelTrigger();

if (assetDir) {
  await page.screenshot({ path: `${assetDir}/2394-narrow-collapsed.png` });
}

await resizePanel(672);
const widePanel = await pressModelTrigger();
if (assetDir) {
  await page.screenshot({ path: `${assetDir}/2394-wide-picker-open.png` });
}

const result = {
  baseCommit: "ad79bbb5ec909524f8f281e62d860c588a86f332",
  appUrl,
  threadId,
  viewport: { width: 1280, height: 800 },
  pressDurationMs: 100,
  narrowPanel,
  widePanel,
};
console.log(JSON.stringify(result, null, 2));
