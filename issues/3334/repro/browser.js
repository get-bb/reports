const p = await browser.getPage('verification');
await p.setViewport({width:390,height:844,isMobile:false,hasTouch:false});
await p.goto('http://127.0.0.1:47335/fallback.html',{timeout:30000});
await p.waitForSelector('button',{timeout:15000});
await p.evaluate(()=>{
  window.changes=[];
  new MutationObserver(ms=>ms.forEach(m=>{
    if(m.attributeName==='data-state') window.changes.push({at:Math.round(performance.now()),state:m.target.getAttribute('data-state')});
  })).observe(document.querySelector('button'),{attributes:true});
});
await p.hover('button');
await new Promise(r=>setTimeout(r,4000));
const result = await p.evaluate(()=>({compact:matchMedia('(max-width: 767px)').matches,coarse:matchMedia('(pointer: coarse)').matches,states:window.changes,ua:navigator.userAgent}));
console.log(JSON.stringify(result));
if(result.states.length > 1) throw new Error('Expected at most one stable hover transition; received '+result.states.length);
