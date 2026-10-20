const page = await browser.getPage("second");
console.log(await page.snapshot());
await page.click("button[aria-expanded]");
const result = await page.evaluate(() => {
  const card = document.querySelector("[data-testid=card]");
  const footer = document.querySelector("[data-testid=footer-body]");
  if (!(card instanceof HTMLElement) || !(footer instanceof HTMLElement)) {
    throw new Error("Missing reproduction elements");
  }
  const rectangle = card.getBoundingClientRect();
  return {
    clipPath: getComputedStyle(footer).clipPath,
    cardTop: rectangle.top,
    footerTop: footer.getBoundingClientRect().top,
    width: rectangle.width,
    height: rectangle.height,
    hit: document.elementsFromPoint(
      rectangle.left + rectangle.width / 2,
      rectangle.top + rectangle.height / 2,
    ).includes(card),
  };
});
console.log(JSON.stringify(result));
if (!result.hit) throw new Error("Footer card is clipped out of pointer hit-testing");
await page.click("[data-testid=card]");
const output = await page.evaluate(() => document.querySelector("[data-testid=clicks]")?.textContent);
if (output !== "Card clicks: 1") throw new Error("Card action did not receive its click");
console.log("PASS: overflowing footer card receives pointer input");
