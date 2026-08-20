// Copy into apps/app and run with node (resolves packages from the pnpm store).
import { unified } from "../../node_modules/.pnpm/unified@11.0.5/node_modules/unified/index.js";
import remarkParse from "../../node_modules/.pnpm/remark-parse@11.0.0/node_modules/remark-parse/index.js";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
const suffix = "\n\n## After\n\n- item";
const cases = {
  "A issue shape: $$x\\n y$$": "$$T_{a}\n\\approx 73$$" + suffix,
  "B open alone, close trailing: $$\\n x$$": "$$\n\\frac{1}{2}$$" + suffix,
  "C open trailing, close alone: $$x\\n$$": "$$\\frac{1}{2}\n$$" + suffix,
  "D canonical block: $$\\n x \\n$$": "$$\n\\frac{1}{2}\n$$" + suffix,
  "E one line $$x$$": "$$\\frac{1}{2}$$" + suffix,
  "F one line with space $$ x $$": "$$ \\frac{1}{2} $$" + suffix,
  "G unclosed inline inside paragraph": "Broken: $$\\frac{1}{" + suffix,
};
for (const [name, body] of Object.entries(cases)) {
  const tree = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkMath, { singleDollarTextMath: false })
    .parse(body);
  const summary = tree.children.map((n) => {
    if (n.type === "math")
      return `math(meta=${JSON.stringify(n.meta)}, value=${JSON.stringify(n.value)})`;
    if (n.type === "paragraph")
      return `paragraph[${n.children
        .map((c) =>
          c.type === "inlineMath"
            ? `inlineMath(${JSON.stringify(c.value)})`
            : c.type,
        )
        .join(",")}]`;
    return n.type;
  });
  console.log(name + "\n  -> " + summary.join(" | "));
}
