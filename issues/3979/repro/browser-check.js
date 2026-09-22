const p = await browser.getPage('main');
const results = [];
for (const state of ['closed', 'open', 'closed-again']) {
  if (state !== 'closed') await p.click('button');
  await new Promise(r => setTimeout(r, 800));
  const before = await p.evaluate(() => {
    const e = document.querySelector('.thread-scrollbar');
    const r = e.getBoundingClientRect();
    return {top:e.scrollTop,height:e.clientHeight,total:e.scrollHeight,x:r.x+r.width/2,y:r.y+r.height/2};
  });
  await p.mouse.move(before.x,before.y);
  await p.mouse.wheel({deltaY:-400});
  await new Promise(r => setTimeout(r, 600));
  const up = await p.evaluate(() => document.querySelector('.thread-scrollbar').scrollTop);
  await p.mouse.wheel({deltaY:200});
  await new Promise(r => setTimeout(r, 600));
  const down = await p.evaluate(() => document.querySelector('.thread-scrollbar').scrollTop);
  results.push({state,before,up,down,pass:up<before.top && down>up});
  await p.shot({type:'jpeg',maxEdge:960,quality:65});
}
console.log(JSON.stringify({agent:await p.evaluate(()=>navigator.userAgent),results}));
if(results.some(r=>!r.pass)) throw new Error('Scroll check failed');
