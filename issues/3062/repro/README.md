# Component browser reproduction

Requires an existing BB checkout with its frozen dependencies installed, Node and Doobie. No production BB process or database is used.

1. Download the files in this directory.
2. Export REPRO_ROOT to a new temporary directory, then run `sh fetch.sh`. This fetches pinned BB and marketplace sources.
3. Copy `main.tsx`, `sdk.tsx`, `index.html`, `build.mjs`, and `verify.js` into `$REPRO_ROOT/harness/`.
4. From the existing BB checkout (for dependency resolution), run `node "$REPRO_ROOT/harness/build.mjs"`.
5. Run `python3 -m http.server 43162 --bind 127.0.0.1 --directory "$REPRO_ROOT/harness"`.
6. Run `doobie --headless -b issue-3062 run "$REPRO_ROOT/harness/verify.js"`.
7. Stop the temporary server and Doobie profile afterward.

The browser script throws on incorrect button counts, sidebar selection, or popup contents. It prints the observed slots and buttons. Six control scenarios and four popup checks pass. Screenshots go to /tmp.

This deliberately bundles a focused component fixture with the existing esbuild dependency, bypassing full application orchestration for investigation. The real slot collector, store, sidebar preference resolver, header renderer and marketplace header components run unmodified. Sidebar bodies/settings are unused stubs; SDK thread hooks return synthetic rows; plugin mounting is reduced to a DOM ownership wrapper; compact viewport is false; fixture CSS supplies basic layout. The installer, backend, full app chrome, and macOS desktop runtime are not exercised.
