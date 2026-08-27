# Reproduction notes for issue 2394

The reproduction used bb commit `ad79bbb5ec909524f8f281e62d860c588a86f332`.
Do not reuse the port from another checkout. The app URL depends on the checkout path.

1. Start the isolated dev app with `scripts/bb-dev-app current`.
2. Copy the printed `App:` URL.
3. Run `eval "$(scripts/bb-dev-app env)"`.
4. Spawn a thread with the commands below.

```sh
thread_json="$(node packages/scripts/dist/commands/run-cli.js thread spawn --project proj_personal --provider codex --permission-mode accept-edits --title "Issue 2394 visual repro" --prompt "Reply only with ok." --json)"
printf '%s\n' "$thread_json"
export BB_REPORT_THREAD_ID="$(printf '%s\n' "$thread_json" | jq -r .id)"
node packages/scripts/dist/commands/run-cli.js thread wait "$BB_REPORT_THREAD_ID" --timeout 180
```

5. Wait for the thread to become idle.
6. Derive the app URL and thread ID. Then run the browser script.

From the reports `issues` directory, run these commands:

```sh
export BB_REPORT_APP_URL="$(node -e 'const url = new URL(process.env.BB_SERVER_URL); url.port = String(Number(url.port) - 8000); process.stdout.write(url.origin)')"
doobie -b bb-report-2394-revise --headless -e \
  "saveFile('issue-2394-config.json', JSON.stringify({ appUrl: '$BB_REPORT_APP_URL', threadId: '$BB_REPORT_THREAD_ID', assetDir: 'assets' }))"
doobie -b bb-report-2394-revise --headless -t 30 \
  run 2394/repro/browser-repro.js | tee 2394/repro/browser-state.json
```

The derived URL equals the `App:` URL that `scripts/bb-dev-app current` prints.
The script sets the viewport to 1280 by 800 pixels.
The script opens the thread and selects the last `Reply in side chat` action.
The script resizes the panel and executes both pointer tests.

The 100 ms press represents a normal human pointer press.
At 270 px, the composer collapsed before the pointer release.
The picker did not open.
At 672 px, the same press opened the picker.

See `browser-state.json` for the exact state values.
See `fix-experiment.diff` for the temporary fix.
