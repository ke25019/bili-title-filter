/**
 * A/B：扩展停用 vs 完全隐藏生效，对比"空的块"是否本来就在。
 */
(async () => {
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const root = () => document.getElementById('bili-filter-host').shadowRoot;
  const step = Number(globalThis.__STEP__ || 0);

  const setEnabled = async (on) => {
    const btn = root().getElementById('bf-enabled');
    if (btn.classList.contains('is-on') !== on) { btn.click(); await sleep(1200); }
  };
  const setMode = async (m) => {
    const b = root().querySelector('#bf-mode button[data-value="' + m + '"]');
    if (b && !b.classList.contains('is-active')) { b.click(); await sleep(800); }
  };
  const addKw = async (kw) => {
    const input = root().getElementById('bf-kw-input');
    input.value = kw;
    root().getElementById('bf-kw-add').click();
    await sleep(900);
  };

  if (step === 0) {
    // A：扩展停用
    await setEnabled(false);
    await sleep(2000);
  } else {
    // B：完全隐藏 + 关键词
    await setMode('hide');
    if (!root().querySelectorAll('#bf-chips .bf-chip').length) {
      for (const kw of ['的', '我', '一', '不', '是', '了']) await addKw(kw);
    }
    await setEnabled(true);
    await sleep(3000);
  }
  scrollTo(0, 0);
  await sleep(1500);

  // 统计"空的块"（无文字、无已加载图片）
  const empties = [];
  document.querySelectorAll('div, section, article, li').forEach((el) => {
    if (el.closest('#bili-filter-host')) return;
    const r = el.getBoundingClientRect();
    if (r.width < 150 || r.height < 100 || r.bottom < 100 || r.top > innerHeight + 200) return;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return;
    if ((el.textContent || '').replace(/\s+/g, '').trim().length > 4) return;
    if (Array.from(el.querySelectorAll('img')).some((i) => i.naturalWidth > 0)) return;
    const chain = [];
    let cur = el;
    for (let i = 0; i < 6 && cur && cur !== document.body; i++) {
      let s = cur.tagName.toLowerCase();
      const cls = (typeof cur.className === 'string' ? cur.className : '').trim().split(/\s+/).filter(Boolean).slice(0, 2).join('.');
      if (cls) s += '.' + cls;
      chain.push(s + '(' + Math.round(cur.getBoundingClientRect().width) + 'x' + Math.round(cur.getBoundingClientRect().height) + ')');
      cur = cur.parentElement;
    }
    empties.push({ cls: String(el.className).slice(0, 40), at: Math.round(r.left) + ',' + Math.round(r.top), chain: chain.join(' < ') });
  });

  return {
    phase: step === 0 ? 'A 扩展停用' : 'B 完全隐藏生效',
    enabled: root().getElementById('bf-enabled').classList.contains('is-on'),
    hiddenCards: document.querySelectorAll('.bf-blocked.bf-hide').length,
    collapsed: document.querySelectorAll('.bf-ph-collapsed').length,
    emptyCount: empties.length,
    // 只统计"在可视区域内"的
    emptyInView: empties.filter((e) => { const t = Number(e.at.split(',')[1]); return t > 100 && t < innerHeight; }).length,
    empties: empties.slice(0, 10)
  };
})()
