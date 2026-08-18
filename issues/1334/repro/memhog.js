// Stand-in for an agent-launched descendant (tsc, Chromium renderers, ...).
// Allocates TARGET_MB of anonymous memory, then keeps churning a small buffer
// so it continues to charge the cgroup like a live workload would.
const targetMb = Number(process.argv[2] ?? "700");
const held = [];
for (let i = 0; i < targetMb / 32; i++) {
  held.push(Buffer.alloc(32 * 1024 * 1024, i & 0xff)); // touch every page
}
console.log(`memhog: holding ${held.length * 32} MiB, pid ${process.pid}`);
setInterval(() => {
  const churn = Buffer.alloc(16 * 1024 * 1024, 7);
  held[Math.floor(Math.random() * held.length)][0] = churn[0];
}, 200);
