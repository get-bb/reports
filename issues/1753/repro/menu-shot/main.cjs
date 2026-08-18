// Renders the REAL apps/desktop/src/menu.ts template (bundled to menu.bundle.js by
// build.sh) inside Electron under Xvfb, with the servers list main.ts produces
// for the reporter's state, opens the Window > Server submenu as a popup and
// screenshots the X screen. Output: <out>.png (path from argv[2]).
const { app, BrowserWindow, Menu, desktopCapturer } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const userArgs = process.argv.filter((a) => !a.startsWith("--") && !a.endsWith("main.cjs") && !a.endsWith("/electron"));
const outPath = userArgs[0] ?? path.join(__dirname, "menu.png");
const variant = userArgs[1] ?? "main";
const bundle = variant === "prototype" ? "menu.prototype.bundle.js" : "menu.bundle.js";
const { buildApplicationMenuTemplate } = require(path.join(__dirname, bundle));

const noop = () => {};
const args = {
  accelerators: { closeWindowOrSideTab: undefined, createNewWindow: undefined, openNewTab: undefined, openNewThread: undefined, openSettings: undefined },
  closeWindowOrSideTab: noop, createNewWindow: noop, isMac: false, openNewTab: noop, openNewThread: noop,
  openServerDaemonLogs: noop, openSettings: noop, reloadWindow: noop, selectServer: noop, setServerUrl: noop,
  serverDaemonLogsMenuEnabled: false,
  // main.ts#buildMenuServerItems for: target=custom (unreachable), connectAccountServers=[]
  servers: [
    { checked: false, id: "builtin", name: "This Mac" },
    { checked: true, id: "custom", name: "old-host.tailnet.ts.net:38886" },
  ],
};
if (variant === "prototype") {
  args.serversNote = "No Connect servers — sign in to bb Connect";
}

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 640, height: 360, show: true, backgroundColor: "#ffffff" });
  await win.loadURL("data:text/html;charset=utf-8," + encodeURIComponent("<body style='font:16px system-ui;padding:24px'><b>bb</b> - startup error screen stand-in<br><small>issue #1753 - Window > Server submenu rendered by menu.ts (" + variant + ")</small></body>"));
  const template = buildApplicationMenuTemplate(args);
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
  const windowMenu = template.find((i) => i.label === "Window");
  const serverMenu = windowMenu.submenu.find((i) => i.label === "Server");
  const popup = Menu.buildFromTemplate(serverMenu.submenu);
  setTimeout(() => popup.popup({ window: win, x: 40, y: 80 }), 400);
  setTimeout(async () => {
    const sources = await desktopCapturer.getSources({ types: ["screen"], thumbnailSize: { width: 1024, height: 768 } });
    fs.writeFileSync(outPath, sources[0].thumbnail.toPNG());
    console.log("wrote", outPath, "labels:", serverMenu.submenu.map((i) => i.label ?? "<" + i.type + ">").join(" | "));
    app.exit(0);
  }, 1800);
});
