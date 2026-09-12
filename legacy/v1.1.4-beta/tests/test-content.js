/**
 * B站屏蔽助手 - 内容脚本功能验证（jsdom）
 * 用法：node test-content.js
 *
 * 模拟 DOM 结构全部取自 2025 年 B 站首页的**真实实测结果**（Edge 152 无头实例 CDP 抓取）：
 *  - 视频卡片：.feed-card > .bili-feed-card > .bili-video-card
 *  - 直播推广楼层：.floor-card-inner > (.cover-container 封面 + .pb-16.px-12 > p.title 标题)
 *  - 顶部轮播横幅：.vui_carousel > .vui_carousel__slides > .carousel-area（11 张幻灯片）
 *  - 隐藏的侧边推广：.palette-button-inner 里的 0×0 反馈链接（曾导致整页被遮蔽）
 *  - 顶栏「直播 / 番剧」入口：.channel-link__right（绝不能被屏蔽）
 *
 * 尺寸：jsdom 没有排版引擎，因此用 data-w / data-h 模拟真实尺寸，
 * 用于验证「过大容器绝不遮蔽」这条安全阀。
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const ROOT = path.join(__dirname, '..');
const DEFAULTS_SRC = fs.readFileSync(path.join(ROOT, 'shared', 'defaults.js'), 'utf8');
const CONTENT_SRC = fs.readFileSync(path.join(ROOT, 'content', 'content.js'), 'utf8');

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
    <!-- 顶部轮播横幅 -->
    <div class="vui_carousel vui_carousel--bottom" id="banner" data-w="500" data-h="365">
      <div class="vui_carousel__slides">
        <div class="vui_carousel__slide">
          <div class="carousel-area" data-w="500" data-h="281">
            <div class="carousel-footer">
              <div class="carousel-footer-title">
                <a href="https://www.bilibili.com/bangumi/play/ep5137676">新番推广横幅</a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 隐藏的侧边推广位：实测 0×0，曾被误判成卡片导致整页空白 -->
    <div class="palette-button-outer">
      <div class="palette-button-inner" id="palette" data-w="1401" data-h="808">
        <div class="palette-button-wrap">
          <div class="storage-box hidden">
            <div class="storable-items">
              <a class="primary-btn feedback" href="https://www.bilibili.com/blackboard/activity-xKR6yNjuJ6.html">反馈</a>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 过大的"卡片"：即使里面有分区链接也不能遮蔽 -->
    <div class="huge-promo-card" id="hugebox" data-w="1401" data-h="808">
      <a href="https://game.bilibili.com/blhx/"><img src="game.jpg"></a>
      <p class="title">游戏中心推广</p>
    </div>

    <div class="feed-list" id="feed-list">
      <div class="feed-card" id="c1" data-w="240" data-h="210">
        <div class="bili-feed-card">
          <div class="bili-video-card is-rcmd">
            <a class="bili-video-card__image--link" href="//www.bilibili.com/video/BV1aa"><img src="cover1.jpg"></a>
            <h3 class="bili-video-card__info--tit" title="【剧透警告】新番结局深度解析">【剧透警告】新番结局深度解析</h3>
            <span class="bili-video-card__info--author">某UP主</span>
          </div>
        </div>
      </div>

      <div class="feed-card" id="c2" data-w="240" data-h="210">
        <div class="bili-feed-card">
          <div class="bili-video-card is-rcmd">
            <a class="bili-video-card__image--link" href="//www.bilibili.com/video/BV1bb"><img src="cover2.jpg"></a>
            <h3 class="bili-video-card__info--tit" title="正常的一个视频">正常的一个视频</h3>
            <span class="bili-video-card__info--author">良心UP主</span>
          </div>
        </div>
      </div>

      <!-- 直播推广楼层：真实结构与真实类名（工具类，非 BEM） -->
      <div class="floor-single-card" id="live-floor">
        <div class="floor-card single-card">
          <div class="floor-card-inner" id="c4" data-w="238" data-h="224">
            <div class="cover-container" data-w="238" data-h="134">
              <a href="https://live.bilibili.com/1852636221"><img src="live.jpg"></a>
            </div>
            <div class="pb-16 px-12 flex flex-col" data-w="238" data-h="80">
              <p class="title indent-initial"><a class="font-medium" href="https://live.bilibili.com/1852636221">某主播的直播间</a></p>
            </div>
          </div>
        </div>
      </div>

      <!-- 未分类的客户端下载推广：由「其他推广」兜底 -->
      <div class="feed-card" id="c8" data-w="240" data-h="210">
        <div class="bili-feed-card">
          <div class="bili-video-card">
            <a class="bili-video-card__image--link" href="https://app.bilibili.com/"><img src="app.jpg"></a>
            <h3 class="bili-video-card__info--tit" title="下载哔哩哔哩客户端">下载哔哩哔哩客户端</h3>
          </div>
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

  // 用 data-w / data-h 模拟真实尺寸（jsdom 本身没有排版引擎，rect 恒为 0）
  win.Element.prototype.getBoundingClientRect = function () {
    const w = Number((this.getAttribute && this.getAttribute('data-w')) || 0);
    const h = Number((this.getAttribute && this.getAttribute('data-h')) || 0);
    return { width: w, height: h, top: 0, left: 0, right: w, bottom: h, x: 0, y: 0 };
  };

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
  const maskCount = () => doc.querySelectorAll('.bf-mask').length;

  async function pushSettings(patch) {
    const next = Object.assign({}, store.sync.bfSettings || {}, patch);
    store.sync.bfSettings = next;
    onChangedListeners.forEach((f) => f({ bfSettings: { newValue: next } }, 'sync'));
    await sleep(100);
  }

  await sleep(300);

  console.log('\n[1] 初始化与页面内面板');
  check('内容脚本已加载', !!win.__BF_CONTENT_LOADED__);
  const host = $('bili-filter-host');
  const shadow = host && host.shadowRoot;
  check('悬浮面板已挂载到页面', !!host);
  check('面板使用 Shadow DOM 隔离', !!shadow);
  check('面板包含 14 种分区选项', !!(shadow && shadow.querySelectorAll('.bf-type').length === 14),
    shadow ? shadow.querySelectorAll('.bf-type').length : 'n/a');
  check('面板包含「屏蔽首页顶部轮播横幅」开关', !!(shadow && shadow.getElementById('bf-banner')));
  check('面板不再包含「整行板块」开关', !(shadow && shadow.getElementById('bf-sections')));
  check('面板包含「重置位置」入口', !!(shadow && shadow.getElementById('bf-reset-pos')));

  console.log('\n[2] 默认状态下不误伤');
  check('普通视频未被屏蔽', !blocked('c2'));
  check('直播推广卡片未被屏蔽', !blocked('c4'));
  check('顶栏「直播」入口未被屏蔽', !doc.querySelector('.channel-link__right').classList.contains('bf-blocked'));
  check('隐藏的侧边推广位未被遮蔽', !blocked('palette'));
  check('超大容器未被遮蔽', !blocked('hugebox'));

  console.log('\n[3] 关键词 + 整体遮蔽');
  await pushSettings({ enabled: true, mode: 'mask', keywords: ['剧透'] });
  check('命中屏蔽词的视频被标记 bf-blocked', blocked('c1'));
  check('未命中的视频不受影响', !blocked('c2'));
  const mask1 = $('c1').querySelector(':scope > .bf-mask');
  check('生成了遮蔽区域 .bf-mask', !!mask1);
  check('遮蔽文案正确', mask1 && mask1.querySelector('.bf-mask__text').textContent === '根据您的屏蔽词已将此视频屏蔽', maskText($('c1')));
  check('显示命中屏蔽词', mask1 && mask1.querySelector('.bf-mask__sub').textContent.indexOf('剧透') !== -1);
  check('提示文案为「鼠标悬停可查看」', mask1 && mask1.querySelector('.bf-mask__hint').textContent === '鼠标悬停可查看');

  console.log('\n[4] 悬停自动展示视频');
  check('初始不是展示状态', !$('c1').classList.contains('bf-revealed'));
  $('c1').dispatchEvent(new win.MouseEvent('mouseenter'));
  check('鼠标移入后自动展示（bf-revealed）', $('c1').classList.contains('bf-revealed'));
  $('c1').dispatchEvent(new win.MouseEvent('mouseleave'));
  check('鼠标移出后自动恢复屏蔽', !$('c1').classList.contains('bf-revealed'));
  await pushSettings({ revealOnHover: false });
  $('c1').dispatchEvent(new win.MouseEvent('mouseenter'));
  check('关闭悬停展示后移入不再展示', !$('c1').classList.contains('bf-revealed'));
  await pushSettings({ revealOnHover: true });

  console.log('\n[5] 完全隐藏模式');
  await pushSettings({ mode: 'hide' });
  check('命中视频被完全隐藏 bf-hide', $('c1').classList.contains('bf-hide'));
  await pushSettings({ mode: 'mask' });
  check('切回遮蔽后 bf-hide 被移除', !$('c1').classList.contains('bf-hide'));
  await pushSettings({ keywords: [] });

  console.log('\n[6] 分区屏蔽 · 卡片级（真实直播楼层结构）');
  await pushSettings({ blockTypes: { live: true } });
  check('直播推广卡片被识别并遮蔽（.floor-card-inner）', blocked('c4'), 'c4 未屏蔽');
  check('分区类型标记为 live', $('c4').dataset.bfType === 'live', $('c4').dataset.bfType);
  check('分区文案包含分区名「直播」', maskText($('c4')).indexOf('直播') !== -1, maskText($('c4')));
  check('【关键】封面与标题只生成一个遮罩（不再分开屏蔽）', maskCount() === 1, '遮罩数=' + maskCount());
  check('【关键】遮罩挂在同时含封面与标题的卡片本体上',
    !!$('c4').querySelector(':scope > .bf-mask') &&
    !!$('c4').querySelector('.cover-container') &&
    !!$('c4').querySelector('p.title'));
  check('封面容器自身没有被单独遮蔽', !$('c4').querySelector('.cover-container').classList.contains('bf-blocked'));
  check('标题区自身没有被单独遮蔽', !$('c4').querySelector('.pb-16').classList.contains('bf-blocked'));

  console.log('\n[7] 安全阀：绝不遮蔽过大的容器（v1.1.3 页面空白回归点）');
  check('隐藏的 0×0 侧边推广位没有被遮蔽（导航区排除）', !blocked('palette'));
  check('1401×808 的超大容器没有被遮蔽', !blocked('hugebox'));
  check('推荐流容器没有被遮蔽', !blocked('feed-list'));
  check('main 没有被遮蔽', !doc.querySelector('main').classList.contains('bf-blocked'));
  check('body 没有被遮蔽', !doc.body.classList.contains('bf-blocked'));
  const allBlocked = Array.from(doc.querySelectorAll('.bf-blocked')).map((el) => el.id || el.className);
  check('被遮蔽的只有直播推广卡片本身', allBlocked.length === 1 && allBlocked[0] === 'c4', allBlocked.join(' | '));

  console.log('\n[8] 「其他推广」兜底开关');
  await pushSettings({ blockTypes: { live: false, other: true } });
  check('未分类的客户端下载推广被兜底识别并屏蔽', blocked('c8'), 'c8 未屏蔽');
  check('兜底类型标记为 other', $('c8').dataset.bfType === 'other', $('c8').dataset.bfType);
  check('关掉直播后直播卡片不会被兜底抓回来', !blocked('c4'));
  check('普通视频卡片不会被兜底规则误伤', !blocked('c1') && !blocked('c2'));
  await pushSettings({ blockTypes: { other: false } });
  check('关闭兜底后恢复', !blocked('c8'));

  console.log('\n[9] 首页顶部轮播横幅（独立开关）');
  check('默认不屏蔽横幅', doc.querySelectorAll('.bf-banner-blocked').length === 0);
  await pushSettings({ blockBanner: true });
  check('开启后横幅容器被标记', $('banner').classList.contains('bf-banner-blocked'));
  await pushSettings({ blockBanner: false });
  check('关闭后横幅恢复', !$('banner').classList.contains('bf-banner-blocked'));
  check('横幅开关与分区开关互不影响', !blocked('c4') && !blocked('c8'));

  console.log('\n[10] 顶栏与横幅不被误伤');
  check('顶栏「直播」入口未被屏蔽', !doc.querySelector('.channel-link__right').classList.contains('bf-blocked'));
  check('顶栏「番剧」入口未被屏蔽', !doc.querySelectorAll('.channel-link__right')[1].classList.contains('bf-blocked'));
  check('横幅不受分区卡片级开关影响', !$('banner').classList.contains('bf-blocked') && !$('banner').querySelector('.bf-mask'));

  console.log('\n[11] 解除屏蔽');
  await pushSettings({ keywords: [], blockTypes: {}, blockBanner: false });
  check('直播推广卡片恢复显示', !blocked('c4'));
  check('遮蔽区域被移除', maskCount() === 0, '残留遮罩=' + maskCount());
  check('兜底卡片恢复', !blocked('c8'));

  console.log('\n[12] 正则 / 大小写 / UP主匹配');
  await pushSettings({ keywords: ['^【.*?】'], useRegex: true });
  check('正则屏蔽词生效', blocked('c1'));
  await pushSettings({ keywords: ['【剧透'], useRegex: false, caseSensitive: true });
  check('区分大小写模式下中文关键词仍生效', blocked('c1'));
  await pushSettings({ keywords: [], caseSensitive: false, matchUpName: true });
  await pushSettings({ keywords: ['良心UP主'] });
  check('可选匹配 UP 主名称', blocked('c2'));
  await pushSettings({ keywords: [], matchUpName: false });
  check('关闭 UP 主匹配后恢复', !blocked('c2'));

  console.log('\n[13] 动态新增卡片（滚动懒加载，不触发设置变更）');
  await pushSettings({ keywords: ['营销号'] });
  const extra = doc.createElement('div');
  extra.className = 'feed-card';
  extra.id = 'c9';
  extra.setAttribute('data-w', '240');
  extra.setAttribute('data-h', '210');
  extra.innerHTML = '<div class="bili-feed-card"><div class="bili-video-card is-rcmd">' +
    '<a class="bili-video-card__image--link" href="//www.bilibili.com/video/BV9zz"><img src="x.jpg"></a>' +
    '<h3 class="bili-video-card__info--tit" title="营销号又来了">营销号又来了</h3></div></div>';
  doc.querySelector('main').appendChild(extra);
  await sleep(500);
  check('新卡片被 MutationObserver 自动扫描并屏蔽', $('c9').classList.contains('bf-blocked'), '未被屏蔽');

  console.log('\n[14] 总开关');
  await pushSettings({ enabled: false });
  check('停用后不再屏蔽', !$('c9').classList.contains('bf-blocked'));
  await pushSettings({ enabled: true });
  check('重新启用后恢复屏蔽', $('c9').classList.contains('bf-blocked'));

  console.log('\n[15] 悬浮按钮可自由拖动');
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
  btn.dispatchEvent(new win.MouseEvent('pointerdown', { bubbles: true, clientX: 300, clientY: 220 }));
  win.dispatchEvent(new win.MouseEvent('pointerup', { bubbles: true, clientX: 300, clientY: 220 }));
  check('原地点击（未移动）可以打开面板', panel.hidden === false);
  shadow.getElementById('bf-reset-pos').dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  check('「重置位置」清空保存的位置', store.local.bfButtonPos === null || store.local.bfButtonPos === undefined);

  console.log('\n[16] 深色模式适配');
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
