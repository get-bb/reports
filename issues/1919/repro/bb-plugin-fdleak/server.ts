// Mimics a chatty plugin (e.g. Factory) that calls bb.storage.database()
// inside every service method instead of caching it at load time.
export default function plugin(bb: any) {
  bb.http.route(
    "GET",
    "/ping",
    async () => {
      const db = bb.storage.database();
      const row = db.prepare("SELECT 1 AS one").get();
      return Response.json({ ok: true, one: row.one, pid: process.pid });
    },
    { auth: "none" },
  );
}
