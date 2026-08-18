// Probe a Playwright WebKit build (run via run-old-webkit160.sh (see setup-harness.sh) for the old
// Safari 16.0-era engine) for the JS/CSS features the bb web bundle relies on.
// Usage: node wk-feature-probe.mjs
import { webkit } from "playwright";
const browser = await webkit.launch();
const page = await browser.newPage();
await page.goto("about:blank");
const r = await page.evaluate(() => {
  const t = (name, fn) => {
    try {
      fn();
      return [name, "ok"];
    } catch (e) {
      return [name, String(e)];
    }
  };
  return {
    ua: navigator.userAgent,
    results: [
      t("regex lookbehind /(?<=\\n)/ (from @pierre/diffs)", () => new RegExp("(?<=\\n)")),
      t("regex lookbehind + \\p{P} /gu (from mdast-util-gfm-autolink-literal)", () =>
        new RegExp("(?<=^|\\s|\\p{P}|\\p{S})([-.\\w+]+)@", "gu"),
      ),
      t("class static block", () => (0, eval)("class A { static { } }")),
      t("Array.prototype.at", () => [1].at(0)),
      t("Object.hasOwn", () => Object.hasOwn({}, "a")),
      t("structuredClone", () => structuredClone({})),
      t("Element.checkVisibility", () => document.body.checkVisibility()),
      t("URLSearchParams.size", () => {
        if (new URLSearchParams("a=1").size !== 1) throw new Error("undefined");
      }),
    ],
    css: {
      colorMix: CSS.supports("color", "color-mix(in oklch, red 50%, blue)"),
      nesting: CSS.supports("selector(&)"),
      registerProperty: typeof CSS.registerProperty === "function",
      dvh: CSS.supports("height", "100dvh"),
    },
  };
});
console.log(JSON.stringify(r, null, 2));
await browser.close();
