/**
 * 真实页面复核：完全隐藏模式下「外层盒子是否真的消失」
 *
 * 背景（用户反馈 + DOM 证据）：首页「分区推荐」卡片外面套着一层 .floor-card
 * （border + background + box-shadow），卡片本体是里面的 .floor-card-inner，
 * 卡片背后还垫着 .layer / .layer.tiny 两块灰色层。
 * 之前 CSS 写成 .bf-blocked.bf-hide / .bf-blocked.bf-hide-slot，
 * 而外层容器永远不会有 .bf-blocked → 类名打上了、样式一条没命中，
 * 于是卡片内容消失、白壳留在页面上。
 *
 * 这个场景不看类名，直接读浏览器算出来的 display / visibility：
 * 只要被屏蔽卡片的上层还有"看得见、有背景/边框/阴影、面积不小"的元素，就算残留。
 *
 * 用法：BF_STEP=keep node probe.js scenarios/partition-residual.js
 *       BF_STEP=remove node probe.js scenarios/partition-residual.js
 */
(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const root = () => {
    const host = document.getElementById('bili-filter-host');
    return host && host.shadowRoot;
  };

  const step = globalThis.__STEP__ || 'keep';

  // ---- 打开面板 ----
  const host = document.getElementById('bili-filter-host');
  if (!host || !host.shadowRoot) return { error: '页面上没有注入面板（扩展没加载？）' };
  const sr = host.shadowRoot;
  const panel = sr.getElementById('bf-panel');
  if (panel && panel.hidden) {
    sr.getElementById('bf-toggle').click();
    await sleep(300);
  }

  // ---- 设定：完全隐藏 + 保留/移除位置 ----
  const modeBtn = sr.querySelector('#bf-mode button[data-value="hide"]');
  if (modeBtn && !modeBtn.classList.contains('is-active')) { modeBtn.click(); await sleep(700); }

  const keepSlot = sr.getElementById('bf-keepslot');
  const wantKeep = step === 'keep';
  const isOn = keepSlot.classList.contains('is-on');
  if (isOn !== wantKeep) { keepSlot.click(); await sleep(700); }

  // ---- 打开所有分区开关（用户反馈的正是分区推广卡片） ----
  sr.querySelectorAll('#bf-types .bf-type').forEach((el) => {
    if (!el.classList.contains('is-active')) el.click();
  });
  await sleep(1200);

  // 滚动触发扫描，让内容都懒加载出来
  for (const y of [0, 700, 1400, 0]) { scrollTo(0, y); await sleep(900); }
  await sleep(2500);

  // ---- 判定工具 ----
  const visibleBox = (el) => {
    const cs = getComputedStyle(el);
    if (cs.display === 'none') return false;
    if (cs.visibility === 'hidden') return false;
    const r = el.getBoundingClientRect();
    return r.width * r.height > 4000;                       // 面积够大才算"一块"
  };
  const painted = (cs) =>
    cs.backgroundColor !== 'rgba(0, 0, 0, 0)' ||
    cs.borderTopWidth !== '0px' ||
    cs.borderBottomWidth !== '0px' ||
    cs.boxShadow !== 'none';

  const blocked = Array.from(document.querySelectorAll('.bf-blocked'));
  const hiddenOk = blocked.filter((el) => {
    const cs = getComputedStyle(el);
    return step === 'keep' ? cs.visibility === 'hidden' : cs.display === 'none';
  }).length;

  // 被屏蔽卡片往上 5 层：还有"看得见 + 有装饰"的就记下来
  const residuals = [];
  blocked.forEach((card) => {
    let cur = card.parentElement;
    for (let i = 0; cur && cur !== document.body && i < 5; i++) {
      if (visibleBox(cur)) {
        const cs = getComputedStyle(cur);
        if (painted(cs)) {
          residuals.push({
            card: String(card.className).slice(0, 34),
            cardKind: card.dataset.bfKind + ':' + (card.dataset.bfType || ''),
            cls: String(cur.className).slice(0, 52),
            size: Math.round(cur.getBoundingClientRect().width) + 'x' + Math.round(cur.getBoundingClientRect().height),
            display: cs.display, visibility: cs.visibility,
            bg: cs.backgroundColor, border: cs.borderTopWidth, shadow: cs.boxShadow.slice(0, 28)
          });
        }
      }
      cur = cur.parentElement;
    }
  });

  // 徽标误判回归：封面链接不该被当成一张卡片
  const linkAsCard = Array.from(document.querySelectorAll('a[data-bf-card]'))
    .filter((a) => a.closest('.cover-container, .floor-card-inner')).length;
  const maskInLink = document.querySelectorAll('a > .bf-mask, a .bf-mask').length;

  // 背后的灰层是否还露着
  const layersVisible = Array.from(document.querySelectorAll('.layer')).filter(visibleBox).length;

  return {
    step,
    keepSlotSwitch: keepSlot.classList.contains('is-on'),
    mode: (sr.querySelector('#bf-mode button.is-active') || {}).textContent,
    blockedCards: blocked.length,
    blockedHiddenCorrectly: hiddenOk,
    residualsCount: residuals.length,
    residuals: residuals.slice(0, 12),
    coverLinkTreatedAsCard: linkAsCard,
    maskInsideLink: maskInLink,
    visibleLayers: layersVisible,
    viewport: innerWidth + 'x' + innerHeight,
    stats: (sr.getElementById('bf-stats') || {}).textContent
  };
})()
