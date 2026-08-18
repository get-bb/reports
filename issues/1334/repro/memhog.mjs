// Simulates an agent-launched descendant (e.g. a browser automation daemon)
// that keeps a working set resident inside the bb-app service cgroup.
// Usage: node memhog.mjs <targetMiB> [holdSeconds]
const targetMiB = Number(process.argv[2] ?? "1024");
const holdSeconds = Number(process.argv[3] ?? "120");
const chunkMiB = 32;
const chunks = [];
const start = Date.now();
while (chunks.length * chunkMiB < targetMiB) {
  const b = Buffer.allocUnsafe(chunkMiB * 1024 * 1024);
  b.fill(chunks.length & 0xff); // touch every page so it is really resident
  chunks.push(b);
  process.stdout.write(
    `memhog: resident ~${chunks.length * chunkMiB} MiB after ${((Date.now() - start) / 1000).toFixed(1)}s\n`,
  );
}
process.stdout.write(
  `memhog: holding ${chunks.length * chunkMiB} MiB for ${holdSeconds}s, re-touching pages\n`,
);
const end = Date.now() + holdSeconds * 1000;
let i = 0;
while (Date.now() < end) {
  // Keep the working set hot so reclaim cannot push the cgroup back under memory.high.
  const b = chunks[i % chunks.length];
  for (let off = 0; off < b.length; off += 4096) b[off] = (b[off] + 1) & 0xff;
  i++;
}
process.stdout.write("memhog: done\n");
