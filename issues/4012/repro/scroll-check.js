const p = await browser.getPage("main");
const state = () => p.evaluate(() => [...document.querySelectorAll(".thread-scrollbar")].map(e => ({top:e.scrollTop, height:e.clientHeight, total:e.scrollHeight})));
const settle = () => p.evaluate(() => new Promise(resolve => setTimeout(resolve, 500)));
const samples = [];
for (const [pane,x] of [[0,300],[1,900]]) {
  await p.mouse.move(x,250);
  for (const deltaY of [-120,48,-7,7]) {
    const before = await state();
    await p.mouse.wheel({deltaY});
    await settle();
    const after = await state();
    const movement = after[pane].top - before[pane].top;
    samples.push({pane,deltaY,before:before[pane].top,after:after[pane].top,movement});
    if (Math.sign(movement) !== Math.sign(deltaY)) throw new Error(JSON.stringify(samples));
  }
}
console.log(JSON.stringify({userAgent:await p.evaluate(() => navigator.userAgent),samples},null,2));
await p.shot({type:"jpeg",maxEdge:1280,quality:85});
