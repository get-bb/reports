function pushWithSpread(count) {
  const target = [];
  target.push(...new Array(count).fill(0));
  return target.length;
}

let low = 0;
let high = 300_000;
while (low + 1 < high) {
  const middle = Math.floor((low + high) / 2);
  try {
    pushWithSpread(middle);
    low = middle;
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    high = middle;
  }
}

console.log(`largest successful spread: ${low}`);
console.log(`smallest failing spread: ${high}`);
try {
  pushWithSpread(high);
} catch (error) {
  console.log(`${error.name}: ${error.message}`);
}
