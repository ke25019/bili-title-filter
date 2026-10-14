/**
 * 深挖"页面底部一大片空白"：反复滚动加载，找出底部空白由谁撑起来。
 */
(async () => {
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const root = () => document.getElementById('bili-filter-host').shadowRoot;

  // 确保处于完全隐藏 + 关键词状态
  const btn = root().getElementById('bf-enabled');
  if (!btn.classList.contains('is-on')) { btn.click(); await sleep(1200); }
  const hideBtn = root().querySelector('#bf-mode button[data-value="hide"]');
  if (hideBtn && !hideBtn.classList.contains('is-active')) { hideBtn.click(); await sleep(800); }
  if (!root().querySelectorAll('#bf-chips .bf-chip').length) {
    for (const kw of ['的', '我', '一', '不', '是', '了']) {
      const input = root().getElementById('bf-kw-input');
      input.value = kw;
      root().getElementById('bf-kw-add').click();
      await sleep(800);
    }
  }
  await sleep(1500);

  // 反复滚动到底，尽量把内容加载出来
  for (let i = 0; i < 8; i++) {
    scrollTo(0, document.documentElement.scrollHeight);
    await sleep(1500);
  }
  await sleep(2000);

  const docH = document.documentElement.scrollHeight;

  // 1) 最后一个"真实内容"的底部
  let lastBottom = 0, lastCls = '';
  document.querySelectorAll('.feed-card, .bili-video-card, .floor-single-card, .bili-feed-card').forEach((el) => {
    const r = el.getBoundingClientRect();
    const hidden = getComputedStyle(el).display === 'none';
    const hasContent = !!el.querySelector('img') || (el.textContent || '').trim().length > 3;
    if (!hidden && hasContent && r.height > 0) {
      const bottom = r.bottom + scrollY;
      if (bottom > lastBottom) { lastBottom = bottom; lastCls = String(el.className).slice(0, 40); }
    }
  });

  // 2) 底部区域里"又大又空"的元素（高度撑起页面但没内容）
  const spacers = [];
  document.querySelectorAll('div, section, main, ul').forEach((el) => {
    if (el.closest('#bili-filter-host')) return;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return;
    const absBottom = r.bottom + scrollY;
    if (absBottom < lastBottom - 40) return;               // 只看底部之后的部分
    if (r.height < 150) return;
    const text = (el.textContent || '').replace(/\s+/g, '').trim();
    if (text.length > 4) return;
    if (Array.from(el.querySelectorAll('img')).some((i) => i.naturalWidth > 0)) return;
    spacers.push({
      cls: (el.tagName.toLowerCase() + '.' + String(el.className).trim().split(/\s+/).slice(0, 3).join('.')).slice(0, 52),
      h: Math.round(r.height), top: Math.round(r.top), absTop: Math.round(r.top + scrollY),
      w: Math.round(r.width),
      display: cs.display, position: cs.position,
      children: el.children.length,
      childClasses: Array.from(el.children).slice(0, 6).map((c) => String(c.className).slice(0, 24)).join(' | '),
      collapsedKids: el.querySelectorAll('.bf-ph-collapsed').length
    });
  });

  // 3) 统计
  const stats = {
    docHeight: docH,
    scrollY: Math.round(scrollY),
    lastContentBottom: Math.round(lastBottom),
    lastContentCls: lastCls,
    bottomBlank: Math.round(docH - lastBottom),
    hiddenCards: document.querySelectorAll('.bf-blocked.bf-hide').length,
    collapsed: document.querySelectorAll('.bf-ph-collapsed').length,
    muted: document.querySelectorAll('.bf-ph-muted').length,
    gridChildren: (document.querySelector('.container.is-version8') || { children: [] }).children.length,
    realCards: Array.from(document.querySelectorAll('.feed-card')).filter((el) => {
      const r = el.getBoundingClientRect();
      return r.height > 0 && (!!el.querySelector('img') || (el.textContent || '').trim().length > 3);
    }).length
  };

  // 4) 底部空白的几个候选（按高度排序）
  spacers.sort((a, b) => b.h - a.h);

  scrollTo(0, 0);
  await sleep(600);
  return { stats, spacerCount: spacers.length, spacers: spacers.slice(0, 12) };
})()
