const sdkResult = [{ id: "thread-1", title: "Example thread" }];
const { threads } = sdkResult;

console.log(`Array.isArray(result): ${Array.isArray(sdkResult)}`);
console.log(`result.length: ${sdkResult.length}`);
console.log(`destructured threads: ${String(threads)}`);
