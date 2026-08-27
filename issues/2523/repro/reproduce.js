const page = await browser.getPage("issue-2523-repro");
const targetUrl = page.url();
if (!targetUrl.includes("/threads/")) {
  throw new Error("Open the fixture thread on the named page first.");
}
const threadId = new URL(targetUrl).pathname.split("/").filter(Boolean).at(-1);
if (!threadId) {
  throw new Error("The thread URL does not contain a thread ID.");
}
await page.browser().defaultBrowserContext().overridePermissions(
  new URL(targetUrl).origin,
  ["clipboard-read", "clipboard-write"],
);
await page.waitForSelector("[data-timeline-row-id]", {
  visible: true,
  timeout: 10000,
});

const readTimeline = async () =>
  await page.evaluate(async (id) => {
    const response = await fetch(
      `/api/v1/threads/${encodeURIComponent(id)}/timeline?segmentLimit=20`,
    );
    if (!response.ok) {
      throw new Error(`Timeline request failed with ${response.status}.`);
    }
    return await response.json();
  }, threadId);
const initialTimeline = await readTimeline();
const initialUserRowIds = initialTimeline.rows
  .filter((row) => row.kind === "conversation" && row.role === "user")
  .map((row) => row.id);

const composer = ".ProseMirror";
await page.click(composer);
await page.keyboard.down("Control");
await page.keyboard.press("a");
await page.keyboard.up("Control");
await page.keyboard.press("Backspace");

const selectionState = await page.evaluate(() => {
  const prose = [...document.querySelectorAll("[data-sidebar-swipe-selectable]")]
    .find((node) => node.textContent?.trim());
  const textNode = prose?.querySelector("p")?.firstChild;
  const row = prose?.closest("[data-timeline-row-id]");
  const followingRow = row?.nextElementSibling;
  if (!(textNode instanceof Text) || !(followingRow instanceof Element)) {
    throw new Error(
      "The thread needs an assistant paragraph with a following timeline row.",
    );
  }

  const range = document.createRange();
  range.setStart(textNode, 0);
  range.setEnd(followingRow, 0);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
  const text = selection?.toString() ?? "";
  return {
    json: JSON.stringify(text),
    length: text.length,
    trailingWhitespace: text.length - text.trimEnd().length,
    rowId: row?.getAttribute("data-timeline-row-id"),
    followingRowId: followingRow.getAttribute("data-timeline-row-id"),
  };
});

await page.keyboard.down("Control");
await page.keyboard.press("c");
await page.keyboard.up("Control");
const clipboardText = await page.evaluate(
  async () => await navigator.clipboard.readText(),
);

const beforeHeight = await page.$eval(
  composer,
  (element) => element.getBoundingClientRect().height,
);
await page.click(composer);
await page.keyboard.down("Control");
await page.keyboard.press("v");
await page.keyboard.up("Control");
await page.waitForFunction(
  () => (document.querySelector(".ProseMirror")?.textContent?.length ?? 0) > 0,
  { timeout: 5000 },
);
const composerState = await page.$eval(composer, (element) => ({
  innerText: JSON.stringify(element.innerText),
  html: element.innerHTML,
  height: element.getBoundingClientRect().height,
}));

await page.keyboard.press("Enter");
await page.waitForFunction(
  async ({ id, previousIds }) => {
    const response = await fetch(
      `/api/v1/threads/${encodeURIComponent(id)}/timeline?segmentLimit=20`,
    );
    if (!response.ok) return false;
    const timeline = await response.json();
    return timeline.rows.some(
      (row) =>
        row.kind === "conversation" &&
        row.role === "user" &&
        !previousIds.includes(row.id),
    );
  },
  { timeout: 10000 },
  { id: threadId, previousIds: initialUserRowIds },
);
const submittedTimeline = await readTimeline();
const submittedUserRow = submittedTimeline.rows.find(
  (row) =>
    row.kind === "conversation" &&
    row.role === "user" &&
    !initialUserRowIds.includes(row.id),
);
if (!submittedUserRow) {
  throw new Error("The submitted user row did not appear in the timeline.");
}

({
  threadId,
  selection: selectionState,
  clipboard: {
    json: JSON.stringify(clipboardText),
    length: clipboardText.length,
    trailingWhitespace: clipboardText.length - clipboardText.trimEnd().length,
  },
  composer: { beforeHeight, ...composerState },
  submittedUserRow: {
    id: submittedUserRow.id,
    text: submittedUserRow.text,
    trailingWhitespace:
      submittedUserRow.text.length - submittedUserRow.text.trimEnd().length,
  },
});
