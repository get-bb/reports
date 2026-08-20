const page = await browser.getPage("pr1979");
await page.setViewport({ width: 1500, height: 950 });

await new Promise((r) => setTimeout(r, 5000));
await page.screenshot({ path: "/tmp/bb-reports/issues/assets/1985-pr1979-pdf.png" });
const info = await page.evaluate(() => {
  const frames = Array.from(document.querySelectorAll("iframe")).map((f) => ({
    src: f.getAttribute("src"),
    title: f.title,
    sandbox: f.getAttribute("sandbox"),
    w: f.clientWidth,
    h: f.clientHeight,
  }));
  return { frames, text: document.body.innerText.split("\n").filter((l) => /Preview|pdf/i.test(l)) };
});
info;
