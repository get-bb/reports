import { app, BrowserWindow } from "electron";

const eventCount = Number.parseInt(process.argv.at(-1) ?? "", 10);

if (!Number.isInteger(eventCount) || eventCount < 1) {
  throw new Error("Pass a positive input-event count.");
}

app.disableHardwareAcceleration();

async function run() {

const window = new BrowserWindow({
  show: false,
  webPreferences: {
    sandbox: true,
  },
});

const page = `<!doctype html>
<html><body><input autofocus>
<script>
globalThis.receivedEvents = 0;
new PerformanceObserver(() => {}).observe({ type: "event", buffered: true, durationThreshold: 16 });
document.addEventListener("keydown", () => { globalThis.receivedEvents += 1; });
document.addEventListener("keyup", () => { globalThis.receivedEvents += 1; });
</script></body></html>`;

await window.loadURL(`data:text/html,${encodeURIComponent(page)}`);
await window.webContents.executeJavaScript("document.querySelector('input').focus()");

const debug = window.webContents.debugger;
debug.attach("1.3");

const runtime = await debug.sendCommand("Browser.getVersion");
const startedAt = performance.now();
const stall = debug
  .sendCommand("Runtime.evaluate", {
    expression:
      "globalThis.stallEnd = performance.now() + 1500; while (performance.now() < globalThis.stallEnd) {}; performance.now()",
    returnByValue: true,
  })
  .then(() => performance.now());

const pendingInputs = [];
for (let index = 0; index < eventCount; index += 1) {
  const down = index % 2 === 0;
  pendingInputs.push(
    debug.sendCommand("Input.dispatchKeyEvent", {
      type: down ? "keyDown" : "keyUp",
      code: "KeyA",
      key: "a",
      ...(down ? { text: "a" } : {}),
    }),
  );
}

await Promise.all(pendingInputs);
const inputsAcknowledgedAt = performance.now();
const stallFinishedAt = await stall;
const result = await debug.sendCommand("Runtime.evaluate", {
  expression: "globalThis.receivedEvents",
  returnByValue: true,
});
const finishedAt = performance.now();

process.stdout.write(
  `${JSON.stringify({
    electron: process.versions.electron,
    chromium: process.versions.chrome,
    browserProduct: runtime.product,
    eventCount,
    receivedEvents: result.result.value,
    stallMs: Math.round(stallFinishedAt - startedAt),
    inputDrainMs: Math.round(inputsAcknowledgedAt - stallFinishedAt),
    totalMs: Math.round(finishedAt - startedAt),
  })}\n`,
);

debug.detach();
window.destroy();
app.quit();
}

app.whenReady().then(run).catch((error) => {
  process.stderr.write(`${error.stack ?? error}\n`);
  app.exit(1);
});
