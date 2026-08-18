// Probe for get-bb/bb#1753 report: does BrowserWindow.loadURL() reject for an
// unreachable saved custom target? (main.ts#applyServerTarget awaits it and
// desktop-window-factory.ts#loadUrlIntoWindow rethrows anything but ERR_ABORTED,
// so a rejection aborts the rest of runDesktopApp, incl. connectServerSync.syncNow().)
const { app, BrowserWindow } = require("electron");
const url = process.argv[process.argv.length - 1];
app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false });
  const started = Date.now();
  try {
    await win.loadURL(url);
    console.log(`loadURL(${url}) RESOLVED after ${Date.now() - started}ms`);
  } catch (error) {
    console.log(`loadURL(${url}) REJECTED after ${Date.now() - started}ms: ${error instanceof Error ? error.message : String(error)}`);
  }
  app.exit(0);
});
