const p = await browser.getPage('main');
const results = [];
for (const run of ['first', 'second']) {
  for (const item of [{width:390,custom:false},{width:844,custom:false},{width:390,custom:true}]) {
    await p.setViewport({width:item.width,height:900,deviceScaleFactor:1,isMobile:true,hasTouch:true});
    await p.goto('http://127.0.0.1:' + (run === 'first' ? 49370 : 49371) + '/' + run + '.html');
    if (item.custom) await p.evaluate(() => {
      document.documentElement.style.setProperty('--text-sm','12px');
      document.documentElement.style.setProperty('--text-base','12px');
    });
    const measured = await p.evaluate(() => {
      const editor = document.querySelector('.ProseMirror');
      editor.focus();
      return {width:innerWidth,coarse:matchMedia('(pointer: coarse)').matches,font:getComputedStyle(editor).fontSize,scale:visualViewport.scale};
    });
    results.push({run,custom:item.custom,...measured});
  }
}
await p.evaluate((r) => { document.querySelector('#result').textContent=JSON.stringify(r,null,2); },results);
console.log(JSON.stringify(results,null,2));
await p.shot({type:'jpeg',maxEdge:1200,quality:90});
