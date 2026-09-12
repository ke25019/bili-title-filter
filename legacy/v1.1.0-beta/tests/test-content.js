/**
 * B站屏蔽助手 - 内容脚本功能验证（jsdom）
 * 用法：node test-content.js
 *
 * 校验点：面板挂载与拖动 / 关键词遮蔽 / 悬停自动展示 / 完全隐藏 /
 *         分区卡片级屏蔽（已知类名 + 未知类名通用识别）/ 分区板块级屏蔽 /
 *         顶栏导航不被误伤 / 动态新增卡片 / 总开关 / 深色模式
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const ROOT = path.join(__dirname, '..');
const DEFAULTS_SRC = fs.readFileSync(path.join(ROOT, 'shared', 'defaults.js'), 'utf8');
const CONTENT_SRC = fs.readFileSync(path.join(ROOT, 'content', 'content.js'), 'utf8');

/**
 * 模拟 DOM 结构取自 2025 年 B 站首页真实结构：
 *  - 视频卡片：.feed-card > .bili-feed-card > .bili-video-card
 *  - 直播卡片：.feed-card > .bili-feed-card > .bili-live-card
 *  - 顶栏「直播」入口：.channel-link__right（绝不能被屏蔽）
 *  - 顶部轮播横幅：.carousel-area（番剧推广，属于板块）
 *  - 直播楼层：.home-live-floor > .floor-title + .home-live-row > 多张卡片
 */
const HTML = `<!DOCTYPE html><html><head></head><body>
  <div class="bili-header">
    <div class="channel-items__right">
      <a class="channel-link__right" href="//live.bilibili.com">直播</a>
      <a class="channel-link__right" href="//www.bilibili.com/anime/">番剧</a>
    </div>
    <div class="right-entry"></div>
    <div id="nav-searchform"></div>
  </div>
  <main>
    <div class="carousel-area" id="banner">
      <div class="carousel-container">
        <div class="carousel-item">
          <div class="carousel-footer">
            <div class="carousel-footer-title">
              <a href="https://www.bilibili.com/bangumi/play/ep5137676">新番推广横幅</a>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="feed-card" id="c1">
      <div class="bili-feed-card">
        <div class="bili-video-card is-rcmd">
          <a class="bili-video-card__image--link" href="//www.bilibili.com/video/BV1aa"><div class="cover"></div></a>
          <h3 class="bili-video-card__info--tit" title="【剧透警告】新番结局深度解析">【剧透警告】新番结局深度解析</h3>
          <span class="bili-video-card__info--author">某UP主</span>
        </div>
      </div>
    </div>

    <div class="feed-card" id="c2">
      <div class="bili-feed-card">
        <div class="bili-video-card is-rcmd">
          <a class="bili-video-card__image--link" href="//www.bilibili.com/video/BV1bb"><div class="cover"></div></a>
          <h3 class="bili-video-card__info--tit" title="正常的一个视频">正常的一个视频</h3>
          <span class="bili-video-card__info--author">良心UP主</span>
        </div>
      </div>
    </div>

    <div class="feed-card" id="c3">
      <div class="bili-feed-card">
        <div class="bili-live-card">
          <a class="bili-live-card__image--link" href="https://live.bilibili.com/2263"><div class="cover"></div></a>
          <div class="bili-live-card__info--tit">正在直播：某个主播</div>
        </div>
      </div>
    </div>

    <div class="home-live-floor" id="live-floor">
      <div class="floor-title" id="live-title">正在直播</div>
      <div class="home-live-row" id="live-row">
        <div class="unknown-live-box" id="c4">
          <a href="https://live.bilibili.com/9999"><div class="cover"></div></a>
          <div class="live-tit">正在直播：另一个主播</div>
        </div>
        <div class="unknown-live-box" id="c5">
          <a href="https://live.bilibili.com/8888"><div class="cover"></div></a>
          <div class="live-tit">正在直播：第三个主播</div>
        </div>
      </div>
    </div>
  </main>
</body></html>`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let pass = 0;
let fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  \u2713 ' + name); }
  else { fail++; console.log('  \u2717 ' + name + (extra !== undefined ? '  -> ' + extra : '')); }
}

async function main() {
  const store = { sync: {}, local: {} };
  const onChangedListeners = [];

  function pick(s, keys) {
    const out = {};
    if (typeof keys === 'string') { if (keys in s) out[keys] = s[keys]; return out; }
    if (Array.isArray(keys)) { keys.forEach((k) => { if (k in s) out[k] = s[k]; }); return out; }
    return Object.assign({}, s);
  }
  function area(name) {
    return {
      get(keys, cb) {
        const s = store[name] || (store[name] = {});
        const res = keys ? pick(s, keys) : Object.assign({}, s);
        if (cb) setTimeout(() => cb(res), 0);
        return undefined;
      },
      set(obj, cb) {
        const s = store[name] || (store[name] = {});
        Object.assign(s, obj);
        if (cb) setTimeout(cb, 0);
        return undefined;
      }
    };
  }

  const dom = new JSDOM(HTML, { runScripts: 'outside-only', pretendToBeVisual: true, url: 'https://www.bilibili.com/' });
  const win = dom.window;

  win.chrome = {
    storage: {
      sync: area('sync'),
      local: area('local'),
      onChanged: { addListener: (fn) => onChangedListeners.push(fn) }
    },
    runtime: {
      lastError: null,
      onMessage: { addListener() {} },
      sendMessage(_msg, cb) { if (cb) setTimeout(() => cb({ today: 0, total: 0 }), 0); },
      openOptionsPage() {}
    }
  };

  win.eval(DEFAULTS_SRC);
  win.eval(CONTENT_SRC);

  const doc = win.document;
  const $ = (id) => doc.getElementById(id);
  const maskText = (el) => {
    const m = el.querySelector(':scope > .bf-mask');
    return m ? m.querySelector('.bf-mask__text').textContent : '(无)';
  };
  const blocked = (id) => $(id).classList.contains('bf-blocked');

  async function pushSettings(patch) {
    const next = Object.assign({}, store.sync.bfSettings || {}, patch);
    store.sync.bfSettings = next;
    onChangedListeners.forEach((f) => f({ bfSettings: { newValue: next } }, 'sync'));
    await sleep(80);
  }

  await sleep(300);

  console.log('\n[1] 初始化与页面内面板');
  check('内容脚本已加载', !!win.__BF_CONTENT_LOADED__);
  const host = $('bili-filter-host');
  const shadow = host && host.shadowRoot;
  check('悬浮面板已挂载到页面', !!host);
  check('面板使用 Shadow DOM 隔离', !!shadow);
  check('面板包含屏蔽方式切换', !!(shadow && shadow.getElementById('bf-mode')));
  check('面板包含 9 种分区选项', !!(shadow && shadow.querySelectorAll('.bf-type').length === 9),
    shadow ? shadow.querySelectorAll('.bf-type').length : 'n/a');
  check('面板包含「整行板块」开关', !!(shadow && shadow.getElementById('bf-sections')));
  check('面板包含「重置位置」入口', !!(shadow && shadow.getElementById('bf-reset-pos')));

  console.log('\n[2] 默认状态下不误伤');
  check('普通视频未被屏蔽', !blocked('c2'));
  check('直播卡片未被屏蔽', !blocked('c3'));
  check('顶栏「直播」入口未被屏蔽', !doc.querySelector('.channel-link__right').classList.contains('bf-blocked'));

  console.log('\n[3] 关键词 + 整体遮蔽');
  await pushSettings({ enabled: true, mode: 'mask', keywords: ['剧透'] });
  check('命中屏蔽词的视频被标记 bf-blocked', blocked('c1'));
  check('未命中的视频不受影响', !blocked('c2'));
  const mask1 = $('c1').querySelector(':scope > .bf-mask');
  check('生成了遮蔽区域 .bf-mask', !!mask1);
  check('遮蔽文案正确', mask1 && mask1.querySelector('.bf-mask__text').textContent === '根据您的屏蔽词已将此视频屏蔽', maskText($('c1')));
  check('显示命中屏蔽词', mask1 && mask1.querySelector('.bf-mask__sub').textContent.indexOf('剧透') !== -1);
  check('提示文案为「鼠标悬停可查看」', mask1 && mask1.querySelector('.bf-mask__hint').textContent === '鼠标悬停可查看',
    mask1 ? mask1.querySelector('.bf-mask__hint').textContent : 'n/a');

  console.log('\n[4] 悬停自动展示视频');
  check('初始不是展示状态', !$('c1').classList.contains('bf-revealed'));
  $('c1').dispatchEvent(new win.MouseEvent('mouseenter'));
  check('鼠标移入后自动展示（bf-revealed）', $('c1').classList.contains('bf-revealed'));
  $('c1').dispatchEvent(new win.MouseEvent('mouseleave'));
  check('鼠标移出后自动恢复屏蔽', !$('c1').classList.contains('bf-revealed'));
  await pushSettings({ revealOnHover: false });
  $('c1').dispatchEvent(new win.MouseEvent('mouseenter'));
  check('关闭悬停展示后移入不再展示', !$('c1').classList.contains('bf-revealed'));
  check('关闭后遮蔽层拦截点击（无 bf-hoverable）', !$('c1').classList.contains('bf-hoverable'));
  await pushSettings({ revealOnHover: true });
  check('重新开启后恢复可悬停', $('c1').classList.contains('bf-hoverable'));

  console.log('\n[5] 完全隐藏模式');
  await pushSettings({ mode: 'hide' });
  check('命中视频被完全隐藏 bf-hide', $('c1').classList.contains('bf-hide'));
  await pushSettings({ mode: 'mask' });
  check('切回遮蔽后 bf-hide 被移除', !$('c1').classList.contains('bf-hide'));

  console.log('\n[6] 分区屏蔽 · 卡片级');
  await pushSettings({ blockTypes: { live: true } });
  check('已知结构直播卡片被屏蔽（.feed-card > .bili-live-card）', blocked('c3'));
  check('直播卡片判定类型为 live', $('c3').dataset.bfType === 'live', $('c3').dataset.bfType);
  check('分区文案包含分区名「直播」', maskText($('c3')).indexOf('直播') !== -1, maskText($('c3')));
  check('未知类名的直播卡片被通用识别并屏蔽', blocked('c4'), 'c4 未屏蔽');
  check('同楼层第二张直播卡片也被屏蔽', blocked('c5'));
  check('卡片级不会隐藏整行容器', !$('live-row').classList.contains('bf-section-blocked'));
  check('卡片级不会隐藏楼层标题', !$('live-title').classList.contains('bf-section-blocked'));

  console.log('\n[7] 顶栏与横幅不被误伤');
  check('顶栏「直播」入口未被屏蔽（导航排除生效）', !doc.querySelector('.channel-link__right').classList.contains('bf-blocked'));
  check('顶栏「番剧」入口未被屏蔽', !doc.querySelectorAll('.channel-link__right')[1].classList.contains('bf-blocked'));
  check('顶部轮播横幅不受卡片级影响', !$('banner').classList.contains('bf-blocked')
    && !$('banner').querySelector('.bf-mask'));

  console.log('\n[8] 分区屏蔽 · 板块级');
  await pushSettings({ blockSections: { live: true } });
  check('直播整行被隐藏', $('live-row').classList.contains('bf-section-blocked'));
  check('楼层标题「正在直播」一并隐藏', $('live-title').classList.contains('bf-section-blocked'));
  check('卡片级与板块级互不影响（卡片仍在）', blocked('c3'));

  await pushSettings({ blockTypes: {}, blockSections: { bangumi: true } });
  check('番剧板块级屏蔽命中顶部轮播横幅', $('banner').classList.contains('bf-section-blocked'));
  await pushSettings({ blockSections: {} });
  check('关闭板块级后横幅恢复', !$('banner').classList.contains('bf-section-blocked'));
  check('关闭板块级后直播整行恢复', !$('live-row').classList.contains('bf-section-blocked'));

  console.log('\n[9] 解除屏蔽');
  await pushSettings({ keywords: [], blockTypes: {}, blockSections: {} });
  check('清空搜索词后视频恢复显示', !blocked('c1'));
  check('遮蔽区域被移除', !$('c1').querySelector(':scope > .bf-mask'));
  check('直播卡片恢复', !blocked('c3') && !blocked('c4'));

  console.log('\n[10] 正则 / 大小写 / UP主匹配');
  await pushSettings({ keywords: ['^【.*?】'], useRegex: true });
  check('正则屏蔽词生效', blocked('c1'));
  await pushSettings({ keywords: ['【剧透'], useRegex: false, caseSensitive: true });
  check('区分大小写模式下中文关键词仍生效', blocked('c1'));
  await pushSettings({ keywords: [], caseSensitive: false, matchUpName: true });
  await pushSettings({ keywords: ['良心UP主'] });
  check('可选匹配 UP 主名称', blocked('c2'));
  await pushSettings({ keywords: [], matchUpName: false });
  check('关闭 UP 主匹配后恢复', !blocked('c2'));

  console.log('\n[11] 动态新增卡片（滚动懒加载，不触发设置变更）');
  await pushSettings({ keywords: ['营销号'] });
  const extra = doc.createElement('div');
  extra.className = 'feed-card';
  extra.id = 'c9';
  extra.innerHTML = '<div class="bili-feed-card"><div class="bili-video-card is-rcmd">' +
    '<a class="bili-video-card__image--link" href="//www.bilibili.com/video/BV9zz"></a>' +
    '<h3 class="bili-video-card__info--tit" title="营销号又来了">营销号又来了</h3></div></div>';
  doc.querySelector('main').appendChild(extra);
  await sleep(500);
  check('新卡片被 MutationObserver 自动扫描并屏蔽', $('c9').classList.contains('bf-blocked'), '未被屏蔽');

  console.log('\n[12] 总开关');
  await pushSettings({ enabled: false });
  check('停用后不再屏蔽', !$('c9').classList.contains('bf-blocked'));
  await pushSettings({ enabled: true });
  check('重新启用后恢复屏蔽', $('c9').classList.contains('bf-blocked'));

  console.log('\n[13] 悬浮按钮可自由拖动');
  const btn = shadow.getElementById('bf-toggle');
  const beforeLeft = host.style.left;
  btn.dispatchEvent(new win.MouseEvent('pointerdown', { bubbles: true, clientX: 100, clientY: 20 }));
  win.dispatchEvent(new win.MouseEvent('pointermove', { bubbles: true, clientX: 300, clientY: 220 }));
  check('拖动后位置跟随鼠标变化', host.style.left !== beforeLeft, host.style.left + ' vs ' + beforeLeft);
  win.dispatchEvent(new win.MouseEvent('pointerup', { bubbles: true, clientX: 300, clientY: 220 }));
  check('拖动结束后写入 storage.local.bfButtonPos',
    !!store.local.bfButtonPos && typeof store.local.bfButtonPos.left === 'number',
    JSON.stringify(store.local.bfButtonPos));
  const panel = shadow.getElementById('bf-panel');
  check('拖动不会误触面板', panel.hidden === true);
  const leftAfterDrag = host.style.left;
  btn.dispatchEvent(new win.MouseEvent('pointerdown', { bubbles: true, clientX: 300, clientY: 220 }));
  win.dispatchEvent(new win.MouseEvent('pointerup', { bubbles: true, clientX: 300, clientY: 220 }));
  check('原地点击（未移动）可以打开面板', panel.hidden === false, 'panel.hidden=' + panel.hidden);
  check('原地点击不会改变按钮位置', host.style.left === leftAfterDrag, host.style.left + ' vs ' + leftAfterDrag);
  shadow.getElementById('bf-reset-pos').dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  check('「重置位置」清空保存的位置', store.local.bfButtonPos === null || store.local.bfButtonPos === undefined,
    JSON.stringify(store.local.bfButtonPos));

  console.log('\n[14] 深色模式适配');
  doc.documentElement.setAttribute('data-theme', 'dark');
  await sleep(1600);
  check('识别 B 站深色模式并标记 html.bf-dark', doc.documentElement.classList.contains('bf-dark'));
  check('面板同步切换为深色主题', host.getAttribute('data-theme') === 'dark', host.getAttribute('data-theme'));
  doc.documentElement.setAttribute('data-theme', 'light');
  await sleep(1600);
  check('切回浅色后取消深色标记', !doc.documentElement.classList.contains('bf-dark'));

  console.log('\n========================================');
  console.log('通过 ' + pass + ' 项，失败 ' + fail + ' 项');
  dom.window.close();
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(2); });
