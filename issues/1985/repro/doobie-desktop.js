const pages = await browser.listPages();
const target = pages.find((p) => p.url.startsWith("http://localhost:14918"));
const page = await browser.getPage(target.id);
if (!page.url().includes("thr_pu2wtuaw77")) {
  await page.goto("http://localhost:14918/threads/thr_pu2wtuaw77");
}
await new Promise((r) => setTimeout(r, 7000));
await page.screenshot({ path: "/tmp/bb-reports/issues/assets/1985-desktop-pr1979-hostfile.png" });
const info = await page.evaluate(() => {
  const frames = Array.from(document.querySelectorAll("iframe")).map((f) => ({
    src: (f.getAttribute("src") || "").slice(0, 60),
    title: f.title,
    sandbox: f.getAttribute("sandbox"),
    w: f.clientWidth,
    h: f.clientHeight,
  }));
  return { ua: navigator.userAgent, frames, text: document.body.innerText.split("\n").filter((l) => /Preview|pdf/i.test(l)) };
});
info;
