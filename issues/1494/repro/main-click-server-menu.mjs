// Drive the Electron MAIN process over the Node inspector protocol
// (electron --inspect=<port>) and click an item in the Window ▸ Server menu,
// exactly what a user does with the mouse. Usage:
//   node main-click-server-menu.mjs <inspect-port> <server-item-id>
// <server-item-id> is the menu LABEL, e.g. "This Mac" or "127.0.0.1:47771".
const [port, itemId] = process.argv.slice(2);
const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
const ws = new WebSocket(targets[0].webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0;
const pending = new Map();
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
  }
};
const send = (method, params = {}) =>
  new Promise((resolve) => {
    const i = ++id;
    pending.set(i, resolve);
    ws.send(JSON.stringify({ id: i, method, params }));
  });
const expression = `(() => {
  const { Menu } = process.mainModule.require("electron");
  const menu = Menu.getApplicationMenu();
  const walk = (items, path) => {
    for (const item of items) {
      const here = [...path, item.label || item.role || item.type];
      if (item.label === ${JSON.stringify(itemId)}) {
        item.click();
        return "clicked " + here.join(" > ");
      }
      if (item.submenu) {
        const r = walk(item.submenu.items, here);
        if (r) return r;
      }
    }
    return null;
  };
  return walk(menu.items, []) || "item not found";
})()`;
const res = await send("Runtime.evaluate", { expression, returnByValue: true });
process.stdout.write(JSON.stringify(res.result?.result ?? res, null, 2) + "\n");
ws.close();
