const p = await browser.getPage('repro');
await p.goto('http://127.0.0.1:43162');
await p.waitForSelector('button[aria-label="24 child threads"]');
const results = [];
for (const [name,ids,count,thread,reloads,expected] of [
 ['T3 only',['t3sidebar'],24,'parent',1,1],
 ['T3 reloaded four times',['t3sidebar'],24,'parent',4,1],
 ['four sidebar plugins',['bb-sidebar','gtd-sidebar','t3sidebar','thread-inbox'],24,'parent',1,4],
 ['four plugins, one child',['bb-sidebar','gtd-sidebar','t3sidebar','thread-inbox'],1,'parent',1,4],
 ['four plugins, child open',['bb-sidebar','gtd-sidebar','t3sidebar','thread-inbox'],24,'child-0',1,4],
 ['disable other plugins',['t3sidebar'],24,'parent',1,1]
]) {
 const slots=await p.evaluate((ids,count,thread,reloads)=>window.configure(ids,count,thread,reloads),ids,count,thread,reloads);
 const selected=await p.evaluate(()=>window.selectedSidebar);
 if(selected.kind!=='plugin'||selected.registration.pluginId!=='t3sidebar')throw Error('wrong selected sidebar');
 const buttons=await p.$$eval('#header button',els=>els.map(e=>({label:e.getAttribute('aria-label'),plugin:e.closest('[data-bb-plugin]')?.getAttribute('data-bb-plugin'),dots:e.querySelectorAll('[style*="background-color"]').length})));
 if(buttons.length!==expected) throw Error(name+': expected '+expected+', got '+buttons.length);
 results.push({name,selectedSidebar:selected.registration.pluginId,slots,buttons});
}
await p.evaluate(()=>window.configure(['bb-sidebar','gtd-sidebar','t3sidebar','thread-inbox']));
for(const id of ['bb-sidebar','gtd-sidebar','t3sidebar','thread-inbox']){
 await p.click(`[data-bb-plugin="${id}"] button[aria-expanded]`);
 const count=await p.$$eval(`[data-bb-plugin="${id}"] li`,els=>els.length);
 if(count!==24)throw Error(id+' popup count '+count);
 results.push({popup:id,children:count});
 await p.click(`[data-bb-plugin="${id}"] button[aria-expanded]`);
}
await p.screenshot({path:'/tmp/four-plugins.png'});
await p.click('[data-bb-plugin="t3sidebar"] button[aria-expanded]');
await p.screenshot({path:'/tmp/children-popup.png',fullPage:true});
console.log(JSON.stringify(results,null,2));
