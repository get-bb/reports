const page = await browser.getPage("bb2062");
await page.goto("http://localhost:17877/projects/proj_cfd7bkuva5", { waitUntil: "networkidle2", timeout: 45000 });
await new Promise((r) => setTimeout(r, 2500));
const trigger = await page.$('button[aria-label^="Provider, model and reasoning"]');
await trigger.click();
await new Promise((r) => setTimeout(r, 1000));

async function tab(title) {
  const btn = await page.$(`[role="dialog"] button[title="${title}"]`);
  if (!btn) throw new Error(`no tab ${title}`);
  await btn.click();
}
async function waitRow(re, timeout) {
  await page.waitForFunction(
    (src) => Array.from(document.querySelectorAll('[role="dialog"] button')).some((b) => new RegExp(src).test(b.textContent || "")),
    { timeout },
    re,
  );
  await new Promise((r) => setTimeout(r, 800));
}
async function shot(name) {
  const dialog = await page.$('[role="dialog"]');
  await dialog.screenshot({ path: `/tmp/bb-reports/issues/assets/2062-${name}.png` });
  const box = await dialog.boundingBox();
  const rows = await page.evaluate(() =>
    Array.from(document.querySelectorAll('[role="dialog"] button'))
      .filter((b) => b.querySelector("[title]"))
      .map((el) => el.textContent),
  );
  return { height: box.height, rows };
}

const out = {};
await tab("Fake OMP");
await waitRow("GLM", 40000);
out.fakeOmp = await shot("06-fake-omp-picker-pr2063");

await tab("Claude Code");
await waitRow("Opus", 30000);
out.claude = await shot("05-claude-picker-pr2063");

await tab("Codex");
await waitRow("5\\.", 30000);
out.codex = await shot("07-codex-picker-pr2063");
out
