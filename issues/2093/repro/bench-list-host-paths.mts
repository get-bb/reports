// End-to-end host.list_paths handler timing (walk + fuzzy rank + truncate), as
// the server calls it for one file-search keystroke.
// Usage (from <worktree>/apps/host-daemon):
//   pnpm exec tsx /tmp/bb-reports/issues/2093/repro/bench-list-host-paths.mts <root> <query>
import { listHostPaths } from "/Users/sawyerhood/.bb-machines/bee.getbb.app/checkouts/bb/.claude/worktrees/wf_21e66a79-f02-7/apps/host-daemon/src/command-handlers/host-files.ts";

const [root, query] = process.argv.slice(2);
for (let i = 0; i < 3; i++) {
  const started = performance.now();
  const result = await listHostPaths({
    type: "host.list_paths",
    path: root!,
    query: query!,
    limit: 8,
    includeFiles: true,
    includeDirectories: false,
  });
  const ms = Math.round(performance.now() - started);
  console.log(`run ${i + 1}: ${ms}ms truncated=${result.truncated}`);
  if (i === 2) console.log(result.paths.map((p) => p.path).join("\n"));
}
