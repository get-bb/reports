const p = await browser.getPage('main');
console.log(await p.evaluate(() => {
  const e = document.querySelector('[data-promptbox-editor-scroll]');
  return {
    layout: new URLSearchParams(location.search).get('layout'),
    viewportHeight: innerHeight,
    maxHeight: getComputedStyle(e).maxHeight,
    editorHeight: e.clientHeight,
    scrollHeight: e.scrollHeight,
    footerBottom: document.querySelector('footer').getBoundingClientRect().bottom,
    syntheticShellHeight: 400
  };
}));
