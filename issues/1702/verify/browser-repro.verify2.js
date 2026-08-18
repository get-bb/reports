// Repro for get-bb/bb#1702 on base 16ceb3a54.
// Usage: dev-browser --browser bb1702 --headless --timeout 120 run browser-repro.js
// Env assumed: dev app at APP, tasks plugin installed, projects "Repro Alpha"
// (RPA, id A) with tasks and "Repro Beta" (RPB, id B).
const APP = "http://localhost:15042";
const A = "01M0AKVZCRR5VJQPKCTKJ9D9GP";
const B = "01M0AKW0AWA3NXE3BXP50930M2";
const page = await browser.getPage("main");
await page.setViewportSize({ width: 1400, height: 900 });

const state = async (label) => {
  const board = page.locator('button[aria-pressed]', { hasText: "Board" });
  const list = page.locator('button[aria-pressed]', { hasText: "List" });
  const bp = (await board.count()) ? await board.first().getAttribute("aria-pressed") : "n/a";
  const lp = (await list.count()) ? await list.first().getAttribute("aria-pressed") : "n/a";
  console.log(`[${label}] url=${page.url()} List.aria-pressed=${lp} Board.aria-pressed=${bp}`);
};
const shot = async (name) => saveScreenshot(await page.screenshot(), name);

// 1. Open project A (bare URL) -> list by default
await page.goto(`${APP}/plugins/tasks/tasks/${A}`, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
await state("1 open project A bare");
await shot("verify2-1702-01-project-list.png");

// 2. Toggle to Board
await page.locator('button[aria-pressed]', { hasText: "Board" }).first().click();
await page.waitForTimeout(1200);
await state("2 clicked Board");
await shot("verify2-1702-02-board.png");

// 3. Open a task from the board (click its card)
await page.getByText("RPA-1", { exact: true }).first().click();
await page.waitForTimeout(1200);
await state("3 opened task RPA-1");
await shot("verify2-1702-03-task-detail.png");

// 4a. Click the breadcrumb project name ("Repro Alpha") in the topbar
const crumb = page.getByRole("button", { name: /Repro Alpha/ }).first();
await crumb.click();
await page.waitForTimeout(1200);
await state("4a breadcrumb -> project (EXPECTED board, ACTUAL ?)");
await shot("verify2-1702-04-after-breadcrumb.png");

// 4b. Same but via the Back (Esc) chevron: this one keeps the board.
await page.locator('button[aria-pressed]', { hasText: "Board" }).first().click();
await page.waitForTimeout(600);
await page.getByText("RPA-1", { exact: true }).first().click();
await page.waitForTimeout(800);
await page.getByRole("button", { name: "Back (Esc)" }).click();
await page.waitForTimeout(1000);
await state("4b Back chevron -> project (session ref keeps board)");

// 5. Sidebar: from task detail, click project A in the sidebar
await page.getByText("RPA-1", { exact: true }).first().click();
await page.waitForTimeout(800);
await page.locator("aside, nav").getByText("Repro Alpha", { exact: true }).first().click();
await page.waitForTimeout(1200);
await state("5 sidebar click from task -> project (EXPECTED board, ACTUAL ?)");
await shot("verify2-1702-05-after-sidebar.png");

// 6. Sidebar: from project A on board, click project B (carries board), then from B click A
await page.locator('button[aria-pressed]', { hasText: "Board" }).first().click();
await page.waitForTimeout(600);
await page.locator("aside, nav").getByText("Repro Beta", { exact: true }).first().click();
await page.waitForTimeout(1000);
await state("6a sidebar A(board) -> B (carries current view)");
await page.locator('button[aria-pressed]', { hasText: "List" }).first().click();
await page.waitForTimeout(600);
await page.locator("aside, nav").getByText("Repro Alpha", { exact: true }).first().click();
await page.waitForTimeout(1000);
await state("6b sidebar B(list) -> A (A was last on board; EXPECTED board, ACTUAL ?)");

// 7. Reload behaviour: URL with marker survives, bare URL does not
await page.locator('button[aria-pressed]', { hasText: "Board" }).first().click();
await page.waitForTimeout(600);
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1200);
await state("7a reload of ?view=board URL");
await page.goto(`${APP}/plugins/tasks/tasks/${A}`, { waitUntil: "networkidle" });
await page.waitForTimeout(1200);
await state("7b bare deep link after having chosen board");
await shot("verify2-1702-07-bare-deeplink.png");
console.log("localStorage keys:", await page.evaluate(() => Object.keys(window.localStorage).filter(k => k.startsWith("bb-tasks"))));
