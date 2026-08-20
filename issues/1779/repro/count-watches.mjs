// Subscribe @parcel/watcher to <root> with a given ignore list and print how
// many inotify watches the process holds afterwards.
//   node count-watches.mjs <root> [ignore,entries,comma,separated]
// Run from packages/host-watcher so @parcel/watcher resolves.
import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(process.cwd() + "/");
const watcher = require("@parcel/watcher");
const [root, ignoreCsv] = process.argv.slice(2);
const ignore = ignoreCsv ? ignoreCsv.split(",") : undefined;
function count() {
  let n = 0;
  for (const fd of fs.readdirSync("/proc/self/fdinfo")) {
    try {
      n += fs.readFileSync(`/proc/self/fdinfo/${fd}`, "utf8").split("\n").filter((l) => l.startsWith("inotify wd:")).length;
    } catch {}
  }
  return n;
}
const before = count();
const t0 = Date.now();
const sub = await watcher.subscribe(root, () => {}, ignore ? { ignore } : undefined);
const after = count();
console.log(JSON.stringify({ root, ignore: ignore ?? "(none)", inotifyWatches: after - before, subscribeMs: Date.now() - t0, rssMb: Math.round(process.memoryUsage().rss / 1048576) }));
await sub.unsubscribe();
