#1304 repro artifacts
=====================
run-all.sh <label> <thread url> <loadAll true|false> [hook true|false]
    Drives db-all.js through dev-browser (headless Chromium): opens the thread,
    optionally scrolls to mount all history, types 71 chars at 25 ms cadence
    while CPU-profiling, writes 1304-all-<label>.json (+ .png screenshot).
    hook=true installs a minimal React DevTools hook to count rendered fibers /
    changed context providers per commit (adds its own overhead; use hook=false
    for timing numbers).
db-all.js           the dev-browser script used by run-all.sh
db-depprobe.js / run-depprobe.sh / apply-depprobe.py
                    identity-churn probe for the deps of getLocalFileContextMenuItems
render-probe.ts + instrumentation.diff
                    render counters (window.__bbRenderCounts) read by db-all.js
apply-fix.py / revert-fix.py / fix.diff
                    the proposed fix (see report). fix.diff applies to 16ceb3a54.
threadDetailView.keystroke-rerender.repro.test.tsx
                    vitest repro (fails on main, passes with fix.diff)
1304-all-*.json     raw measurement outputs; 1304-depprobe.out; repro-test-*.log
worktree-full-with-instrumentation.diff  everything that was applied to the worktree during measurement
Older files (db-*.js, 1304-big-*.json, 1304-small.json, fix-experiment.diff) are from an earlier killed attempt.
