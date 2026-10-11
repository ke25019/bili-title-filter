/**
 * 复现"完全隐藏模式下内容中间仍有灰色/白色空块 + 页面底部一大片空白"
 */
(async () => {
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const root = () => document.getElementById('bili-filter-host').shadowRoot;

  const clearKw = async () => {
    for (let i = 0; i < 20; i++) {
      const del = root().querySelector('#bf-chips .bf-chip__del');
      if (!del) break;
      del.click(); await sleep(250);
    }
  };
  const addKw = async (kw) => {
    const input = root().getElementById('bf-kw-input');
    input.value = kw;
    root().getElementById('bf-kw-add').click();
    await sleep(700);
  };
  const setMode = async (m) => {
    const b = root().querySelector('#bf-mode button[data-value="' + m + '"]');
    if (b && !b.classList.contains('is-active')) { b.click(); await sleep(600); }
  };

  await setMode('hide');
  await clearKw();
  for (const kw of ['的', '我', '一', '不', '是', '了']) await addKw(kw);
  await sleep(3000);
  scrollTo(0, 0);
  await sleep(1200);

  const vw = innerWidth, vh = innerHeight;

  // ---- 1) 找"看起来空"的大块元素 ----
  const blocks = [];
  document.querySelectorAll('div, section, article, li').forEach((el) => {
    if (el.closest('#bili-filter-host')) return;
    const r = el.getBoundingClientRect();
    if (r.width < 150 || r.height < 100) return;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return;
    const text = (el.textContent || '').replace(/\s+/g, '').trim();
    if (text.length > 4) return;                       // 有文字 → 真实内容
    const imgs = Array.from(el.querySelectorAll('img'));
    const loaded = imgs.filter((i) => i.naturalWidth > 0).length;
    if (loaded > 0) return;                            // 有已加载图片 → 真实内容
    blocks.push({
      cls: String(el.className).slice(0, 46),
      size: Math.round(r.width) + 'x' + Math.round(r.height),
      at: Math.round(r.left) + ',' + Math.round(r.top),
      text: text.length,
      imgs: imgs.length,
      loaded,
      bg: cs.backgroundColor,
      skeleton: !!el.querySelector('[class*="skeleton"]'),
      collapsed: el.classList.contains('bf-ph-collapsed'),
      muted: el.classList.contains('bf-ph-muted'),
      parentDisplay: el.parentElement ? getComputedStyle(el.parentElement).display : '?'
    });
  });

  // ---- 2) 底部空白量化 ----
  let lastBottom = 0, lastCls = '';
  document.querySelectorAll('.feed-card, .bili-video-card, .floor-single-card, .bili-feed-card').forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.height > 0 && r.bottom > lastBottom) { lastBottom = r.bottom; lastCls = String(el.className).slice(0, 40); }
  });

  // ---- 3) 网格链路上的高度约束 ----
  const chain = [];
  let cur = document.querySelector('.container.is-version8');
  for (let i = 0; cur && cur !== document.documentElement && i < 8; i++) {
    const cs = getComputedStyle(cur);
    const r = cur.getBoundingClientRect();
    chain.push({
      cls: (cur.tagName.toLowerCase() + '.' + String(cur.className).trim().split(/\s+/).slice(0, 2).join('.')).slice(0, 44),
      h: Math.round(r.height),
      height: cs.height, minHeight: cs.minHeight, maxHeight: cs.maxHeight,
      display: cs.display, overflow: cs.overflow
    });
    cur = cur.parentElement;
  }

  const docH = document.documentElement.scrollHeight;
  return {
    keywords: Array.from(root().querySelectorAll('#bf-chips .bf-chip__text')).map((e) => e.textContent),
    stats: root().getElementById('bf-stats').textContent,
    viewport: vw + 'x' + vh,
    hiddenCards: document.querySelectorAll('.bf-blocked.bf-hide').length,
    collapsed: document.querySelectorAll('.bf-ph-collapsed').length,
    muted: document.querySelectorAll('.bf-ph-muted').length,
    grayBlockCount: blocks.length,
    grayBlocks: blocks.slice(0, 14),
    lastContentBottom: Math.round(lastBottom), lastContentCls: lastCls,
    docHeight: docH,
    bottomBlank: Math.round(docH - lastBottom),
    heightChain: chain
  };
})()
