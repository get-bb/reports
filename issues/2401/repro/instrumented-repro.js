const config = JSON.parse(readFile("issue-2401-config.json"));
const page = await browser.getPage("issue-2401-repro");

await page.evaluateOnNewDocument(() => {
  window.__issue2401 = {
    resizeCallbacks: 0,
    resizeEntries: 0,
    resizeStacks: [],
    longTasks: [],
  };
  const NativeResizeObserver = window.ResizeObserver;
  if (NativeResizeObserver) {
    window.ResizeObserver = class extends NativeResizeObserver {
      constructor(callback) {
        super((entries, observer) => {
          window.__issue2401.resizeCallbacks += 1;
          window.__issue2401.resizeEntries += entries.length;
          if (window.__issue2401.resizeStacks.length < 12) {
            window.__issue2401.resizeStacks.push(new Error().stack ?? "");
          }
          callback(entries, observer);
        });
      }
    };
  }
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        window.__issue2401.longTasks.push({
          duration: entry.duration,
          startTime: entry.startTime,
        });
      }
    }).observe({ type: "longtask", buffered: true });
  } catch {}
});

await page.setViewport({ width: 1280, height: 720 });
const threadUrl = `${config.appUrl}/projects/${config.projectId}/threads/${config.threadId}`;
await page.goto(threadUrl);
await page.waitForSelector('section[aria-label="Queued messages"]', {
  visible: true,
  timeout: 15000,
});
await page.waitForFunction(
  () => document.body.innerText.includes("sleep 120"),
  { timeout: 15000 },
);
await page.screenshot({ path: config.triggerScreenshot, type: "png" });

await page.$eval('button[aria-label="Edit queued message 1"]', (element) =>
  element.click(),
);
await page.waitForSelector("[data-queued-message-inline-editor]", {
  visible: true,
  timeout: 5000,
});
await page.screenshot({ path: config.editorScreenshot, type: "png" });

const readSample = async (elapsedMs, phase) => {
  const metrics = await page.metrics();
  const counters = await page.evaluate(() => structuredClone(window.__issue2401));
  const state = await page.$eval(
    'section[aria-label="Queued messages"]',
    (element) => ({
      surfaceHeight: element.getBoundingClientRect().height,
      scrollTop:
        element.querySelector("[data-queued-messages-scroll]")?.scrollTop ??
        null,
      editorHeight:
        element
          .querySelector("[data-queued-message-inline-editor]")
          ?.getBoundingClientRect().height ?? null,
    }),
  );
  return {
    phase,
    elapsedMs,
    resizeCallbacks: counters.resizeCallbacks,
    resizeEntries: counters.resizeEntries,
    longTasks: counters.longTasks.length,
    jsHeapUsedBytes: metrics.JSHeapUsedSize,
    surfaceHeight: state.surfaceHeight,
    scrollTop: state.scrollTop,
    editorHeight: state.editorHeight,
    responsive: true,
  };
};

const samples = [];
let elapsedMs = 0;
for (const delayMs of [0, 250, 750, 2000, 5000]) {
  if (delayMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    elapsedMs += delayMs;
  }
  samples.push(await readSample(elapsedMs, "editor-open"));
}

const viewportChecks = [];
for (const viewport of [
  { width: 1024, height: 768 },
  { width: 900, height: 600 },
  { width: 1440, height: 900 },
]) {
  await page.evaluate(() => {
    window.__issue2401.resizeCallbacks = 0;
    window.__issue2401.resizeEntries = 0;
    window.__issue2401.resizeStacks = [];
    window.__issue2401.longTasks = [];
  });
  await page.setViewport(viewport);
  const timedSamples = [];
  let viewportElapsedMs = 0;
  for (const delayMs of [0, 250, 750, 1000]) {
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      viewportElapsedMs += delayMs;
    }
    timedSamples.push(
      await readSample(
        viewportElapsedMs,
        `viewport-${viewport.width}x${viewport.height}`,
      ),
    );
  }
  viewportChecks.push({ ...viewport, samples: timedSamples });
}

const result = {
  baseCommit: config.baseCommit,
  browser: await page.browser().version(),
  threadUrl,
  initialViewport: { width: 1280, height: 720 },
  resizeStackSamples: await page.evaluate(() =>
    window.__issue2401.resizeStacks.slice(0, 2),
  ),
  samples,
  viewportChecks,
};
saveFile("issue-2401-measurement.json", JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
