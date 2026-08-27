# Issue 2523 live reproduction

1. Start an isolated bb development instance.
2. Create a thread with an assistant paragraph and a later timeline row.
3. Open that thread on the named browser page.
4. Download the script into the bb checkout.

   ```sh
   curl -fsSL \
     https://get-bb.github.io/reports/issues/2523/repro/reproduce.js \
     -o reproduce-2523.js
   doobie --headless -b bb-report-2523 -e \
     'const page = await browser.getPage("issue-2523-repro"); await page.goto("http://localhost:<app-port>/threads/<thread-id>"); page.url()'
   doobie --headless -b bb-report-2523 run reproduce-2523.js
   ```

The script uses trusted keyboard copy and paste actions. It prints the native
selection, clipboard suffix, composer state, and the stored user row after submit.

On the base commit, the clipboard had six trailing newline characters. The
composer height increased from 22.09375 pixels to 154.65625 pixels.
The stored user row had zero trailing whitespace after the script submitted it.
