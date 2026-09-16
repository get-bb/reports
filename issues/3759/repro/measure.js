const p = await browser.getPage("main");
console.log(await p.evaluate(async () => {
  const s = document.querySelector(".thread-scrollbar");
  const w = document.querySelector("[data-timeline-row-list]").parentElement.parentElement;
  s.scrollTop = s.scrollHeight;
  await new Promise(r => setTimeout(r, 400));
  const trace = [];
  const start = performance.now();
  document.querySelector("button").click();
  await new Promise(resolve => {
    function tick() {
      trace.push({ms: Math.round(performance.now() - start), scrollTop: s.scrollTop, height: w.getBoundingClientRect().height});
      if (performance.now() - start < 350) requestAnimationFrame(tick);
      else resolve();
    }
    requestAnimationFrame(tick);
  });
  return {transition: getComputedStyle(w).transition, trace};
}));
