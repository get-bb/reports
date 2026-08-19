// Preload: log every native addon the process loads, in load order.
//   node --require ./log-dlopen.cjs dist/daemon-bundle.mjs <args>
const orig = process.dlopen;
let n = 0;
process.dlopen = function (module, filename, flags) {
  n += 1;
  console.error(`[dlopen #${n}] ${filename}`);
  return flags === undefined ? orig.call(this, module, filename) : orig.call(this, module, filename, flags);
};
process.on("exit", (code) => console.error(`[exit] code=${code} addons loaded=${n}`));
