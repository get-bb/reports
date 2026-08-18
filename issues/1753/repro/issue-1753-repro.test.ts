// Repro for get-bb/bb#1753: Window ▸ Server lists no Connect servers and no
// reason when the sync is skipped (no local runtime, no cached credential).
//
// Test 1 PASSES on main 16ceb3a54 and documents the current behaviour: the skip
// is a log line only and the ConnectServerSync surface has no way to observe it
// (whatever shape a fix picks -- callback, result value, accessor -- would
// change the surface pinned here). Test 2 FAILS on main: it asserts the
// behaviour the issue asks for (a visible reason in the Server submenu).
import { describe, expect, it, vi } from "vitest";
import type { MenuItemConstructorOptions } from "electron";

vi.mock("electron", () => ({
  app: { name: "bb" },
  Menu: { sendActionToFirstResponder: vi.fn() },
}));

import { createConnectServerSync } from "../src/connect-server-sync.js";
import {
  buildApplicationMenuTemplate,
  SET_SERVER_URL_MENU_LABEL,
  type InstallApplicationMenuArgs,
} from "../src/menu.js";

function findServerSubmenu(
  template: MenuItemConstructorOptions[],
): MenuItemConstructorOptions[] {
  const windowMenu = template.find((item) => item.label === "Window");
  const windowSubmenu = windowMenu?.submenu as MenuItemConstructorOptions[];
  const serverMenu = windowSubmenu.find((item) => item.label === "Server");
  return serverMenu?.submenu as MenuItemConstructorOptions[];
}

describe("issue #1753 — skipped Connect sync leaves the Server menu silent", () => {
  it("the sync only logs the skip; nothing observable tells the menu why the list is empty", async () => {
    const logs: string[] = [];
    const onServers = vi.fn();
    const gateFetchImpl = vi.fn(async () => new Response("{}"));
    const fetchImpl = vi.fn();
    const sync = createConnectServerSync({
      // Reporter's state: saved custom target => no local runtime; the app
      // never authenticated to a Connect target => no cached credential.
      getCredential: () => null,
      getLocalServerUrl: () => null,
      gateFetchImpl,
      fetchImpl,
      onServers,
      onUnauthorized: () => undefined,
      log: (m) => logs.push(m),
      setIntervalFn: () => 0,
      clearIntervalFn: () => undefined,
    });

    await sync.syncNow();

    // Nothing was even attempted, and the consumer is never told.
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(gateFetchImpl).not.toHaveBeenCalled();
    expect(onServers).not.toHaveBeenCalled();
    // The reason exists — but only as a log line ...
    expect(logs).toEqual([
      "connect server sync skipped (plugin disabled, not paired, or no local server and no cached credential)",
    ]);
    // ... and the public ConnectServerSync surface exposes no way to read it:
    // this is the complete surface on main (no status accessor, and the only
    // callback, onServers, was not invoked above).
    expect(Object.keys(sync).sort()).toEqual([
      "onListRequested",
      "onRuntimeReady",
      "start",
      "stop",
      "syncNow",
    ]);
  });

  it("the Server submenu built for that state has no item explaining the missing Connect servers", () => {
    // Exactly what main.ts#buildMenuServerItems produces for the reporter's
    // state (builtin + the saved custom target; connectAccountServers = []).
    const args: InstallApplicationMenuArgs = {
      accelerators: {
        closeWindowOrSideTab: undefined,
        createNewWindow: undefined,
        openNewTab: undefined,
        openNewThread: undefined,
        openSettings: undefined,
      },
      closeWindowOrSideTab: () => {},
      createNewWindow: () => {},
      isMac: true,
      openNewTab: () => {},
      openNewThread: () => {},
      openServerDaemonLogs: () => {},
      openSettings: () => {},
      reloadWindow: () => {},
      selectServer: () => {},
      serverDaemonLogsMenuEnabled: false,
      servers: [
        { checked: false, id: "builtin", name: "This Mac" },
        { checked: true, id: "custom", name: "old-host.tailnet.ts.net:38886" },
      ],
      setServerUrl: () => {},
    };
    const submenu = findServerSubmenu(buildApplicationMenuTemplate(args));
    const labels = submenu.map((item) => item.label ?? `<${item.type}>`);

    // What main renders (this part passes and documents the current output):
    expect(labels).toEqual([
      "This Mac",
      "old-host.tailnet.ts.net:38886",
      "<separator>",
      SET_SERVER_URL_MENU_LABEL,
    ]);
    // What the issue asks for — FAILS on main: no disabled/explanatory row.
    expect(
      submenu.some(
        (item) => item.enabled === false && /connect/iu.test(item.label ?? ""),
      ),
    ).toBe(true);
  });
});
