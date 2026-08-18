// Attempt to break PR #1704: a board reached via deep link (no toggle click)
// is not recorded, so the next marker-less navigation loses it.
const APP = "http://localhost:14761";
const A = "01M09XXCTYKRXTHNA44GPBE6RE";
const B = "01M09XXDE4K29Y0TFQP4NGZ44X";
const page = await browser.getPage("main");
await page.setViewportSize({ width: 1400, height: 900 });
const state = async (label) => {
  const board = page.locator('button[aria-pressed]', { hasText: "Board" });
  const bp = (await board.count()) ? await board.first().getAttribute("aria-pressed") : "n/a";
  console.log(`[${label}] url=${page.url()} Board.aria-pressed=${bp} storage=${await page.evaluate(() => window.localStorage.getItem("bb-tasks:view-preferences"))}`);
};
await page.goto(`${APP}/plugins/tasks/tasks/all`, { waitUntil: "networkidle" });
await page.evaluate(() => window.localStorage.clear());
// X1: deep link straight to the board, then click the same project in the sidebar
await page.goto(`${APP}/plugins/tasks/tasks/${A}%3Fview%3Dboard`, { waitUntil: "networkidle" });
await page.waitForTimeout(1200);
await state("X1a deep link ?view=board (fresh storage)");
await page.locator("aside, nav").getByText("Repro Beta", { exact: true }).first().click();
await page.waitForTimeout(1000);
await state("X1b sidebar -> B (pre-PR: carried board; PR: ?)");
await page.locator("aside, nav").getByText("Repro Alpha", { exact: true }).first().click();
await page.waitForTimeout(1000);
await state("X1c sidebar -> A again (pre-PR: board carried; PR: ?)");
// X2: unknown marker
await page.goto(`${APP}/plugins/tasks/tasks/${A}%3Fview%3Dkanban`, { waitUntil: "networkidle" });
await page.waitForTimeout(1000);
await state("X2 ?view=kanban");
// X3: newer-version document -> writes refused, toggle still works?
await page.evaluate(() => window.localStorage.setItem("bb-tasks:view-preferences", JSON.stringify({version: 2, lastUsed: "list", projects: {}})));
await page.goto(`${APP}/plugins/tasks/tasks/${A}`, { waitUntil: "networkidle" });
await page.waitForTimeout(1000);
await page.locator('button[aria-pressed]', { hasText: "Board" }).first().click();
await page.waitForTimeout(800);
await state("X3a toggled Board with future doc");
await page.goto(`${APP}/plugins/tasks/tasks/${A}`, { waitUntil: "networkidle" });
await page.waitForTimeout(1000);
await state("X3b bare URL after toggle with future doc (choice silently not remembered)");
await page.evaluate(() => window.localStorage.clear());
