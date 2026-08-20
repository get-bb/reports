// Run from apps/app (so remark-math resolves):
//   cd apps/app && node /tmp/bb-reports/issues/1778/repro/mdast-dump.mjs
import { unified } from "../../node_modules/.pnpm/unified@11.0.5/node_modules/unified/index.js";
import remarkParse from "../../node_modules/.pnpm/remark-parse@11.0.0/node_modules/remark-parse/index.js";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";

const body = [
  "Before the formula.",
  "",
  "$$T_{\\text{appearance}\\rightarrow\\text{chunk}}",
  "\\approx73\\text{--}146\\text{ ms}$$",
  "",
  "## Content after the formula",
  "",
  "- This should remain a list item.",
  "- [This should remain a link](https://example.com).",
].join("\n");

const tree = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkMath, { singleDollarTextMath: false })
  .parse(body);

for (const node of tree.children) {
  const { position } = node;
  console.log(
    JSON.stringify(
      {
        type: node.type,
        lines: `${position.start.line}-${position.end.line}`,
        ...(node.type === "math" ? { meta: node.meta, value: node.value } : {}),
      },
      null,
      2,
    ),
  );
}
