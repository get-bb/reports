"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/menu.ts
var menu_exports = {};
__export(menu_exports, {
  CLOSE_WINDOW_MENU_LABEL: () => CLOSE_WINDOW_MENU_LABEL,
  FORCE_RELOAD_ACCELERATOR: () => FORCE_RELOAD_ACCELERATOR,
  NEW_THREAD_MENU_LABEL: () => NEW_THREAD_MENU_LABEL,
  NEW_WINDOW_MENU_LABEL: () => NEW_WINDOW_MENU_LABEL,
  OPEN_NEW_TAB_MENU_LABEL: () => OPEN_NEW_TAB_MENU_LABEL,
  OPEN_SETTINGS_MENU_LABEL: () => OPEN_SETTINGS_MENU_LABEL,
  RELOAD_ACCELERATOR: () => RELOAD_ACCELERATOR,
  SERVER_DAEMON_LOGS_MENU_LABEL: () => SERVER_DAEMON_LOGS_MENU_LABEL,
  SERVER_MENU_ITEM_ID: () => SERVER_MENU_ITEM_ID,
  SERVER_MENU_LABEL: () => SERVER_MENU_LABEL,
  SET_SERVER_URL_MENU_LABEL: () => SET_SERVER_URL_MENU_LABEL,
  TOGGLE_DEVELOPER_TOOLS_ACCELERATOR: () => TOGGLE_DEVELOPER_TOOLS_ACCELERATOR,
  TOGGLE_DEVELOPER_TOOLS_MENU_LABEL: () => TOGGLE_DEVELOPER_TOOLS_MENU_LABEL,
  buildApplicationMenuTemplate: () => buildApplicationMenuTemplate,
  installApplicationMenu: () => installApplicationMenu
});
module.exports = __toCommonJS(menu_exports);
var import_electron = require("electron");
var SERVER_DAEMON_LOGS_MENU_LABEL = "Server & Daemon Logs";
var OPEN_NEW_TAB_MENU_LABEL = "New Tab";
var NEW_THREAD_MENU_LABEL = "New Thread";
var NEW_WINDOW_MENU_LABEL = "New Window";
var CLOSE_WINDOW_MENU_LABEL = "Close Window";
var OPEN_SETTINGS_MENU_LABEL = "Settings\u2026";
var TOGGLE_DEVELOPER_TOOLS_MENU_LABEL = "Toggle Developer Tools";
var TOGGLE_DEVELOPER_TOOLS_ACCELERATOR = "Command+Option+I";
var RELOAD_ACCELERATOR = "CommandOrControl+R";
var FORCE_RELOAD_ACCELERATOR = "CommandOrControl+Shift+R";
var SERVER_MENU_LABEL = "Server";
var SERVER_MENU_ITEM_ID = "bb-server-menu";
var SET_SERVER_URL_MENU_LABEL = "Set Server URL\u2026";
function createServerDaemonLogsMenuItems(args) {
  return [
    { type: "separator" },
    {
      enabled: args.serverDaemonLogsMenuEnabled,
      label: SERVER_DAEMON_LOGS_MENU_LABEL,
      click() {
        args.openServerDaemonLogs();
      }
    }
  ];
}
function createServerMenuItems(args) {
  const serverItems = args.servers.map(
    (server) => ({
      checked: server.checked,
      click() {
        args.selectServer(server.id);
      },
      label: server.name,
      type: "radio"
    })
  );
  return [
    ...serverItems,
    { type: "separator" },
    {
      label: SET_SERVER_URL_MENU_LABEL,
      click() {
        args.setServerUrl();
      }
    }
  ];
}
function buildApplicationMenuTemplate(args) {
  return [
    {
      label: import_electron.app.name,
      submenu: [
        { role: "about" },
        { type: "separator" },
        {
          accelerator: args.accelerators.openSettings,
          click() {
            args.openSettings();
          },
          label: OPEN_SETTINGS_MENU_LABEL
        },
        { type: "separator" },
        ...args.isMac ? [
          { role: "services" },
          { type: "separator" },
          { role: "hide" },
          { role: "hideOthers" },
          { role: "unhide" },
          { type: "separator" }
        ] : [],
        { role: "quit" }
      ]
    },
    {
      label: "File",
      submenu: [
        {
          accelerator: args.accelerators.openNewTab,
          click() {
            args.openNewTab();
          },
          label: OPEN_NEW_TAB_MENU_LABEL
        },
        {
          accelerator: args.accelerators.openNewThread,
          click() {
            args.openNewThread();
          },
          label: NEW_THREAD_MENU_LABEL
        },
        {
          accelerator: args.accelerators.createNewWindow,
          click() {
            args.createNewWindow();
          },
          label: NEW_WINDOW_MENU_LABEL
        },
        { type: "separator" },
        {
          accelerator: args.accelerators.closeWindowOrSideTab,
          click(_menuItem, browserWindow) {
            if (browserWindow === null) {
              if (args.isMac) {
                import_electron.Menu.sendActionToFirstResponder("performClose:");
              }
              return;
            }
            args.closeWindowOrSideTab(browserWindow);
          },
          label: CLOSE_WINDOW_MENU_LABEL
        }
      ]
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" }
      ]
    },
    {
      label: "View",
      submenu: [
        {
          accelerator: RELOAD_ACCELERATOR,
          label: "Reload",
          registerAccelerator: false,
          click(_menuItem, browserWindow) {
            args.reloadWindow(browserWindow, false);
          }
        },
        {
          accelerator: FORCE_RELOAD_ACCELERATOR,
          label: "Force Reload",
          registerAccelerator: false,
          click(_menuItem, browserWindow) {
            args.reloadWindow(browserWindow, true);
          }
        },
        {
          accelerator: args.isMac ? TOGGLE_DEVELOPER_TOOLS_ACCELERATOR : "Control+Shift+I",
          label: TOGGLE_DEVELOPER_TOOLS_MENU_LABEL,
          role: "toggleDevTools"
        },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        ...createServerDaemonLogsMenuItems(args)
      ]
    },
    {
      label: "Window",
      submenu: [
        { role: "minimize" },
        ...args.isMac ? [{ role: "zoom" }] : [],
        { type: "separator" },
        {
          id: SERVER_MENU_ITEM_ID,
          label: SERVER_MENU_LABEL,
          submenu: createServerMenuItems(args)
        },
        ...args.isMac ? [
          { type: "separator" },
          { role: "front" }
        ] : []
      ]
    }
  ];
}
function installApplicationMenu(args) {
  const menu = import_electron.Menu.buildFromTemplate(buildApplicationMenuTemplate(args));
  const onServerMenuWillShow = args.onServerMenuWillShow;
  if (onServerMenuWillShow !== void 0) {
    menu.getMenuItemById(SERVER_MENU_ITEM_ID)?.submenu?.on("menu-will-show", () => {
      onServerMenuWillShow();
    });
  }
  import_electron.Menu.setApplicationMenu(menu);
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  CLOSE_WINDOW_MENU_LABEL,
  FORCE_RELOAD_ACCELERATOR,
  NEW_THREAD_MENU_LABEL,
  NEW_WINDOW_MENU_LABEL,
  OPEN_NEW_TAB_MENU_LABEL,
  OPEN_SETTINGS_MENU_LABEL,
  RELOAD_ACCELERATOR,
  SERVER_DAEMON_LOGS_MENU_LABEL,
  SERVER_MENU_ITEM_ID,
  SERVER_MENU_LABEL,
  SET_SERVER_URL_MENU_LABEL,
  TOGGLE_DEVELOPER_TOOLS_ACCELERATOR,
  TOGGLE_DEVELOPER_TOOLS_MENU_LABEL,
  buildApplicationMenuTemplate,
  installApplicationMenu
});
