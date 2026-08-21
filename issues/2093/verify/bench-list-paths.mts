// Times the host daemon's recursive walker (the thing behind host.list_paths)
// against real directories, to compare the walk cost before/after PR #2103.
// Usage (from <worktree>/apps/host-daemon):
//   pnpm exec tsx /tmp/bb-reports/issues/2093/repro/bench-list-paths.ts <root> [<root>...]
import { listPathsRecursively } from "/Users/sawyerhood/.bb-machines/bee.getbb.app/checkouts/bb/.claude/worktrees/wf_21e66a79-f02-16/apps/host-daemon/src/command-handlers/file-list.ts";

for (const root of process.argv.slice(2)) {
  const started = performance.now();
  const entries = await listPathsRecursively({
    dir: root,
    root,
    includeFiles: true,
    includeDirectories: true,
  });
  const ms = Math.round(performance.now() - started);
  const dot = entries.filter((entry) => entry.path.split("/").some((s) => s.startsWith("."))).length;
  console.log(
    `${root}: ${entries.length} entries (${dot} under dot-dirs) in ${ms}ms`,
  );
}
