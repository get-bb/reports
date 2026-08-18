cd /home/sawyer/projects/bb/.claude/worktrees/wf_570fde41-63f-11/apps/app
P=$(node -e "console.log(require('path').dirname(require.resolve('@pierre/diffs/package.json')))")
echo "pierre: $P $(node -e "console.log(require('@pierre/diffs/package.json').version)")"
grep -n 'SPLIT_WITH_NEWLINES' $P/dist/constants.js | head -3
for M in ../../node_modules/.pnpm/mdast-util-gfm-autolink-literal*; do echo $M; grep -n '(?<=' $M/node_modules/mdast-util-gfm-autolink-literal/lib/index.js; done
for O in ../../node_modules/.pnpm/oniguruma-to-es*; do echo $O; grep -n 'unicodeSets' $O/node_modules/oniguruma-to-es/dist/esm/index.js | head -4; done
for R in ../../node_modules/.pnpm/regex@*; do echo $R; grep -n 'unicodeSets\|flagGroups' $R/node_modules/regex/dist/esm/regex.js $R/node_modules/regex/src/utils.js 2>/dev/null | head -6; done
for V in ../../node_modules/.pnpm/vite@8*; do echo $V; grep -o "safari16[.0-9]*\|ios16[.0-9]*" $V/node_modules/vite/dist/node/chunks/*.js | sort | uniq -c | head; done
for V in ../../node_modules/.pnpm/rolldown@*; do echo $V; done
