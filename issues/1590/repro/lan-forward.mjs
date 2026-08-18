// Forward <LAN_IP>:<listenPort> -> 127.0.0.1:<targetPort> so the bb dev app
// (which binds 127.0.0.1 only) can be opened from a real non-loopback HTTP
// origin, i.e. an insecure browsing context. Use a *different* listen port
// than Vite's own port: Vite probes the port on restart and would move away.
// usage: node lan-forward.mjs <LAN_IP> <listenPort>:<targetPort> [...]
import net from "node:net";
const [ip, ...pairs] = process.argv.slice(2);
for (const pair of pairs) {
  const [listenPort, targetPort] = pair.split(":").map(Number);
  net
    .createServer((c) => {
      const u = net.connect(targetPort, "127.0.0.1");
      c.pipe(u);
      u.pipe(c);
      c.on("error", () => u.destroy());
      u.on("error", () => c.destroy());
    })
    .listen(listenPort, ip, () =>
      console.log(`forwarding ${ip}:${listenPort} -> 127.0.0.1:${targetPort}`),
    );
}
