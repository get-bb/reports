// Same shape as oniguruma-to-es's envFlags feature detection (src/utils.js).
export const envFlags = {
  unicodeSets: (() => {
    try {
      new RegExp("[[]]", "v");
    } catch {
      return false;
    }
    return true;
  })(),
};
envFlags.bug = envFlags.unicodeSets && new RegExp("[[^a]]", "v").test("a");
console.log(envFlags);
