for (const [name,port,file] of [['base',48930,'base'],['verify',48931,'verify']]) {
  const p = await browser.getPage(name);
  await p.setViewport({width:393,height:852,isMobile:true,hasTouch:true});
  await p.goto(`http://127.0.0.1:${port}/${file}.html`);
  const read = () => p.evaluate(() => {
    const e=document.querySelector('#display');
    const s=getComputedStyle(e.parentElement);
    const r=e.getBoundingClientRect();
    return {opacity:s.opacity,pointerEvents:s.pointerEvents,coarse:matchMedia('(pointer:coarse)').matches,compact:matchMedia('(max-width:767px)').matches,hit:document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.id,result:document.querySelector('#result').textContent};
  });
  console.log(name, 'before', await read());
  const box = await p.$eval('#display', e => {const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};});
  await p.touchscreen.tap(box.x,box.y);
  const after=await read();
  console.log(name, 'after tap', after);
  if (after.opacity !== '0' || after.pointerEvents !== 'none' || after.result !== 'No tap received' || !after.coarse || !after.compact) throw new Error('Baseline did not reproduce');
}
