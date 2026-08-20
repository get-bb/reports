// Fixture for get-bb/bb#2029. Mirrors the reporter's "lane-watcher":
// a background service that keeps a reference to the plugin's database
// handle and ticks on an interval. It deliberately ignores its abort signal
// (a plugin bug, but one the host must survive).
export default function plugin(bb: any) {
  const db = bb.storage.database();
  db.exec("CREATE TABLE IF NOT EXISTS ticks (at INTEGER)");
  bb.cli.register({
    name: "collab",
    summary: "collab fixture command",
    run() {
      return { exitCode: 0, stdout: "collab ok\n" };
    },
  });
  bb.background.service("lane-watcher", {
    start(_signal: AbortSignal) {
      setInterval(() => {
        try {
          db.prepare("INSERT INTO ticks (at) VALUES (?)").run(Date.now());
        } catch (error) {
          bb.log.error("capacity-interval-unreadable:" + String(error));
        }
      }, 1000);
      return new Promise<void>(() => {});
    },
  });
}
