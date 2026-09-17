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
const CONTENT_CSS = fs.readFileSync(path.join(ROOT, 'content', 'content.css'), 'utf8');

const HTML = `<!DOCTYPE html><html><head><style id="bf-style">${CONTENT_CSS}</style></head><body>
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

    <div class="container is-version8" id="feed-list" style="display:grid">
      <!-- 用户反馈的那张首页「分区推荐」卡片，DOM 原样照抄自 Copy outerHTML：
           封面链接里带着分区徽标 .badge > .floor-title（文案「番剧」），
           卡片背后还垫着 .layer / .layer.tiny 两块灰色层（B 站真实的「叠卡片」效果）。
           这里曾经踩过两个坑：
             ① 徽标文案被当成标题 → 整张卡片识别不出来，只把封面链接当成一张卡片；
             ② 外层带边框 + 阴影的盒子（.floor-card）其实根本没被隐藏 → 残留一块占位白框。 -->
      <div class="floor-single-card" id="badgeHost" data-w="238" data-h="248">
        <div class="single-card floor-card" id="badgeBox" data-w="238" data-h="248"
             style="border:1px solid #e3e5e7;background:#fff;box-shadow:0 0 40px rgba(0,0,0,.03);border-radius:6px">
          <div class="floor-card-inner" id="badgeInner" data-w="238" data-h="224">
            <div class="cover-container" data-w="238" data-h="134">
              <a id="badgeLink" href="//www.bilibili.com/bangumi/play/ep468949"
                 data-mod="partition_recommend.content"><img src="episode.jpg"></a>
              <div class="badge"><svg class="icon-title"></svg><span class="floor-title">番剧</span></div>
            </div>
            <div class="pb-16 px-12 flex flex-col items-start info-container" data-w="238" data-h="90">
              <p class="title indent-initial" title="准备好了？我准备好了！">准备好了？我准备好了！</p>
              <p class="sub-title indent-initial" title="海绵宝宝 登陆B站">海绵宝宝 登陆B站</p>
            </div>
            <div class="layer"></div>
            <div class="layer tiny"></div>
          </div>
        </div>
      </div>

      <!-- 首页「分区推荐」里的直播卡片（DOM 照抄真实页面）：标题里带着「直播中」角标，
           算上 <picture><source><source><img> 一共 8 个后代元素。
           曾经因为"标题元素个数 ≤ 4"这条判据，整张卡片识别不出来 —— 直播开关打开也不屏蔽。 -->
      <div class="floor-single-card" id="liveTagHost" data-w="238" data-h="248">
        <div class="single-card floor-card" id="liveTagBox" data-w="238" data-h="248"
             style="border:1px solid #e3e5e7;background:#fff">
          <div class="floor-card-inner" id="liveTagInner" data-w="238" data-h="224">
            <div class="cover-container" data-w="238" data-h="134">
              <a id="liveTagLink" href="//live.bilibili.com/1888542250"><img src="live3.jpg"></a>
              <div class="badge"><svg class="icon-title"></svg><span class="floor-title">直播</span></div>
            </div>
            <div class="pb-16 px-12 flex flex-col items-start info-container" data-w="238" data-h="90">
              <!-- 标题里的「直播中」角标用 DOM API 拼（见下面的 buildLiveTagTitle）：
                   HTML 解析规则不允许 <p> 里嵌 <div>，而真实页面是 Vue 用 DOM API 建出来的 -->
              <p class="title indent-initial" id="liveTagTitle" title="乖乖女装的好累"></p>
            </div>
          </div>
        </div>
      </div>

      <!-- 分区推广卡片的分类回归：真实页面上这些卡片的链接**全都是** /bangumi/play/epXXXX，
           光看链接谁也分不出是番剧还是国创/综艺/电影，只有封面左上角的徽标能区分；
           赛事卡片则是「直播预约」，链接落在直播间（所以以前开「赛事」没反应）。 -->
      <div class="floor-single-card" data-w="238" data-h="248">
        <div class="single-card floor-card" data-w="238" data-h="248">
          <div class="floor-card-inner" id="tBangumi" data-w="238" data-h="224">
            <div class="cover-container" data-w="238" data-h="134">
              <a href="//www.bilibili.com/bangumi/play/ep100001"><img src="bg1.jpg"></a>
              <div class="badge"><span class="floor-title">番剧</span></div>
            </div>
            <div class="info-container" data-w="238" data-h="90"><p class="title" title="番剧推广卡片">番剧推广卡片</p></div>
          </div>
        </div>
      </div>
      <div class="floor-single-card" data-w="238" data-h="248">
        <div class="single-card floor-card" data-w="238" data-h="248">
          <div class="floor-card-inner" id="tGuochuang" data-w="238" data-h="224">
            <div class="cover-container" data-w="238" data-h="134">
              <a href="//www.bilibili.com/bangumi/play/ep100002"><img src="bg2.jpg"></a>
              <div class="badge"><span class="floor-title">国创</span></div>
            </div>
            <div class="info-container" data-w="238" data-h="90"><p class="title" title="国创推广卡片">国创推广卡片</p></div>
          </div>
        </div>
      </div>
      <div class="floor-single-card" data-w="238" data-h="248">
        <div class="single-card floor-card" data-w="238" data-h="248">
          <div class="floor-card-inner" id="tVariety" data-w="238" data-h="224">
            <div class="cover-container" data-w="238" data-h="134">
              <a href="//www.bilibili.com/bangumi/play/ep100003"><img src="bg3.jpg"></a>
              <div class="badge"><span class="floor-title">综艺</span></div>
            </div>
            <div class="info-container" data-w="238" data-h="90"><p class="title" title="综艺推广卡片">综艺推广卡片</p></div>
          </div>
        </div>
      </div>
      <div class="floor-single-card" data-w="238" data-h="248">
        <div class="single-card floor-card" data-w="238" data-h="248">
          <div class="floor-card-inner" id="tMovie" data-w="238" data-h="224">
            <div class="cover-container" data-w="238" data-h="134">
              <a href="//www.bilibili.com/bangumi/play/ep100004"><img src="bg4.jpg"></a>
              <div class="badge"><span class="floor-title">电影</span></div>
            </div>
            <div class="info-container" data-w="238" data-h="90"><p class="title" title="电影推广卡片">电影推广卡片</p></div>
          </div>
        </div>
      </div>
      <div class="floor-single-card" data-w="238" data-h="248">
        <div class="single-card floor-card" data-w="238" data-h="248">
          <div class="floor-card-inner" id="tMatch" data-w="238" data-h="224">
            <div class="cover-container" data-w="238" data-h="134">
              <a href="//live.bilibili.com/22637261"><img src="bg5.jpg"></a>
              <div class="badge"><span class="floor-title">赛事</span></div>
            </div>
            <div class="info-container" data-w="238" data-h="90"><p class="title" title="赛事直播预约">赛事直播预约</p></div>
          </div>
        </div>
      </div>

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

      <!-- B 站自己的"空占位项"（实测：排在网格末尾，前面卡片被隐藏后会被顶上来，
           显示成一块灰色空盒）。下面几个分别覆盖不同的真实变体。 -->
      <div class="bili-video-card" id="ph1" data-w="240" data-h="233">
        <div class="bili-video-card__skeleton"></div>
      </div>
      <div class="bili-video-card" id="ph2" data-w="240" data-h="233"></div>
      <div class="load-more-anchor" id="anchor1" data-w="240" data-h="233">
        <div class="bili-video-card__skeleton"></div>
      </div>
      <!-- 变体：带"未加载图片"的骨架（只看 naturalWidth，不能因为有 img 就放过） -->
      <div class="bili-video-card" id="ph3" data-w="240" data-h="233">
        <a href="#"><img src="skeleton.jpg"></a>
      </div>
      <!-- 变体：嵌在 .floor-single-card 里（隐藏的卡片隔了一层，仍要能找到网格） -->
      <div class="floor-single-card" data-w="240" data-h="248">
        <div class="floor-card single-card" data-w="240" data-h="248">
          <div class="bili-video-card" id="ph4" data-w="240" data-h="248">
            <div class="bili-video-card__skeleton"></div>
          </div>
        </div>
      </div>
      <!-- 分区推广卡片（真实结构 + 真实 CSS）：外层 .floor-card 带 边框/背景/阴影，卡片本体在里面。
           只隐藏本体的话，外层会留下一个带淡边线的空框（用户反馈的"阴影占位符还在"）。 -->
      <div class="floor-single-card" id="frameHost" data-w="240" data-h="248">
        <div class="floor-card single-card" id="frameBox" data-w="240" data-h="248"
             style="border:1px solid #e3e5e7;background:#fff;box-shadow:0 0 40px rgba(0,0,0,.03);border-radius:6px;padding:12px">
          <div class="floor-card-inner" id="frameInner" data-w="238" data-h="222">
            <div class="cover-container" data-w="238" data-h="134">
              <a href="https://live.bilibili.com/777"><img src="live2.jpg"></a>
            </div>
            <div class="pb-16 px-12" data-w="238" data-h="88">
              <p class="title">剧透警告的直播丁</p>
            </div>
          </div>
        </div>
      </div>

      <!-- 左上角那种"铺满灰底"的大块（真实 CSS：.recommended-swipe-body{background:var(--graph_bg_regular)}）。
           卡片藏在里面，如果只隐藏卡片，这层灰底就露出来变成一块灰色区块。 -->
      <div class="recommended-swipe" id="swipeHost" data-w="500" data-h="485">
        <div class="recommended-swipe-body" id="swipeBody" data-w="500" data-h="485"
             style="background-color:#f1f2f3">
          <div class="bili-video-card" id="swipeCard" data-w="500" data-h="485">
            <a href="//www.bilibili.com/video/BVswipe"><img src="swipe.jpg"></a>
            <h3 class="bili-video-card__info--tit" title="轮播推荐位的视频">轮播推荐位的视频</h3>
          </div>
        </div>
      </div>

      <!-- 又高又空的"占位容器"：只应隐身保留高度，不能真的隐藏（否则页面高度骤变） -->
      <div class="bili-video-card" id="tallPh" data-w="240" data-h="520"></div>
      <!-- 真实卡片：有标题 + 图片还没加载完，绝不能被当成占位项 -->
      <div class="feed-card" id="realCard" data-w="240" data-h="233">
        <div class="bili-feed-card">
          <div class="bili-video-card">
            <a href="//www.bilibili.com/video/BVreal"><img src="loading.jpg"></a>
            <h3 class="bili-video-card__info--tit" title="正常显示的真实视频">正常显示的真实视频</h3>
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

/** 轮询等待条件成立，避免机器负载导致的时序抖动 */
async function waitFor(fn, timeout = 3000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    if (fn()) return true;
    await sleep(50);
  }
  return fn();
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

  /**
   * 直播推广卡片的标题 <p class="title"> 里带着「直播中」角标：
   *   <a class="font-medium"><div class="living"><picture><source><source><img></picture><span>直播中</span></div>标题文字</a>
   * 真实页面是 Vue 用 DOM API 建出来的（HTML 解析规则不允许 <p> 里直接嵌 <div>），
   * 所以这里同样用 DOM API 拼，保证结构与实测一致：标题元素一共 8 个后代。
   */
  function buildLiveTagTitle() {
    const titleEl = $('liveTagTitle');
    const a = doc.createElement('a');
    a.className = 'font-medium';
    a.setAttribute('href', '//live.bilibili.com/1888542250');
    a.setAttribute('data-mod', 'partition_recommend.content');
    const living = doc.createElement('div');
    living.className = 'living';
    living.innerHTML = '<picture class="v-img gif"><source srcset="live.avif">' +
      '<source srcset="live.webp"><img src="live.gif"></picture><span>直播中</span>';
    a.appendChild(living);
    a.appendChild(doc.createTextNode('乖乖女装的好累'));
    titleEl.appendChild(a);
  }
  buildLiveTagTitle();

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
  check('面板包含 18 种分区选项', !!(shadow && shadow.querySelectorAll('.bf-type').length === 18),
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

  console.log('\n[5] 完全隐藏模式的两种行为');
  // 默认：保留原位置（v1.0.0-beta 的行为）
  await pushSettings({ mode: 'hide', hideKeepSlot: true });
  check('默认保留原位置：卡片标记为 bf-hide-slot', $('c1').classList.contains('bf-hide-slot'), $('c1').className);
  check('保留位置时不做 display:none（页面不重排）', !$('c1').classList.contains('bf-hide'));
  check('保留位置时仍带 bf-blocked（内容由 CSS 隐藏）', $('c1').classList.contains('bf-blocked'));
  const cssText = CONTENT_CSS.replace(/\/\*[\s\S]*?\*\//g, '');   // 先去掉注释，只看真正的规则
  check('CSS 定义了保留位置时隐藏遮罩的规则',
    /\.bf-hide-slot\s+\.bf-mask\s*\{[^}]*display:\s*none/.test(cssText));
  check('【关键】保留位置时隐藏的是元素自身（含背景边框与外层盒子），避免留下白色空盒',
    /(^|\})\s*\.bf-hide-slot\s*\{[^}]*visibility:\s*hidden/.test(cssText));
  check('【关键】移除位置的 display:none 不能写成 .bf-blocked 复合选择器（外层容器没有 bf-blocked）',
    /(^|\})\s*\.bf-hide\s*\{[^}]*display:\s*none/.test(cssText) && !/\.bf-blocked\.bf-hide\s*\{/.test(cssText));

  // 关闭保留位置：整卡移除
  await pushSettings({ hideKeepSlot: false });
  check('关闭保留位置后整卡隐藏 bf-hide', $('c1').classList.contains('bf-hide'));
  check('此时不再带 bf-hide-slot', !$('c1').classList.contains('bf-hide-slot'));

  await pushSettings({ mode: 'mask', hideKeepSlot: true });
  check('切回遮蔽后两种隐藏类都被移除',
    !$('c1').classList.contains('bf-hide') && !$('c1').classList.contains('bf-hide-slot'));
  check('切回遮蔽后遮罩恢复显示', $('c1').classList.contains('bf-blocked') && !$('c1').classList.contains('bf-hide-slot'));
  await pushSettings({ keywords: [] });

  console.log('\n[6] 分区屏蔽 · 卡片级（真实直播楼层结构）');
  await pushSettings({ blockTypes: { live: true } });
  check('直播推广卡片被识别并遮蔽（.floor-card-inner）', blocked('c4'), 'c4 未屏蔽');
  check('分区类型标记为 live', $('c4').dataset.bfType === 'live', $('c4').dataset.bfType);
  check('分区文案包含分区名「直播」', maskText($('c4')).indexOf('直播') !== -1, maskText($('c4')));
  check('【关键】封面与标题只生成一个遮罩（不再分开屏蔽）',
    $('c4').querySelectorAll(':scope > .bf-mask').length === 1 &&
    !$('c4').querySelector('.cover-container > .bf-mask') &&
    !$('c4').querySelector('.pb-16 > .bf-mask'),
    'c4 内遮罩数=' + $('c4').querySelectorAll(':scope > .bf-mask').length);
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
  check('被遮蔽的只有直播推广卡片本身（c4、带阴影的 frameInner、带「直播中」角标的 liveTagInner）',
    allBlocked.length === 3 && allBlocked.indexOf('c4') !== -1 &&
    allBlocked.indexOf('frameInner') !== -1 && allBlocked.indexOf('liveTagInner') !== -1,
    allBlocked.join(' | '));

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

  console.log('\n[10] 完全隐藏模式：收敛被顶上来填空的"空占位项"');
  // 遮蔽模式下不应动任何占位项（遮蔽保留占位，不会有东西被顶上来）
  await pushSettings({ mode: 'mask', keywords: ['剧透'] });
  check('遮蔽模式不动占位项', doc.querySelectorAll('.bf-ph-collapsed, .bf-ph-muted').length === 0,
    doc.querySelectorAll('.bf-ph-collapsed, .bf-ph-muted').length);

  await pushSettings({ mode: 'hide', hideKeepSlot: false, keywords: ['剧透'] });
  check('完全隐藏（移除位置）下收敛空占位项（含骨架屏）', $('ph1').classList.contains('bf-ph-collapsed'),
    $('ph1').className);
  check('完全隐藏（移除位置）下收敛完全空白的占位项', $('ph2').classList.contains('bf-ph-collapsed'), $('ph2').className);
  check('加载哨兵只做隐身、保留布局盒（不影响继续加载）',
    $('anchor1').classList.contains('bf-ph-muted') && !$('anchor1').classList.contains('bf-ph-collapsed'),
    $('anchor1').className);
  check('真实卡片不会被当成占位项收敛', !$('c2').classList.contains('bf-ph-collapsed')
    && !$('c1').classList.contains('bf-ph-collapsed') && !$('c4').classList.contains('bf-ph-collapsed'));
  check('有图有文的卡片即使被屏蔽也不进占位收敛', !$('c1').classList.contains('bf-ph-collapsed'));

  // 占位项被真实内容填充后要自动恢复
  $('ph1').innerHTML = '<a href="//www.bilibili.com/video/BVnew"><img src="new.jpg"></a>' +
    '<h3 class="bili-video-card__info--tit" title="新加载的真实卡片">新加载的真实卡片</h3>';
  check('占位项被真实内容填充后自动恢复显示',
    await waitFor(() => !$('ph1').classList.contains('bf-ph-collapsed')), $('ph1').className);

  console.log('\n[10b] 空占位识别的边界（对照真实页面上踩过的坑）');
  await pushSettings({ mode: 'hide', hideKeepSlot: false, keywords: ['剧透'] });
  // 收敛可能发生在自身，也可能发生在它的祖先上（例如整个空楼层被收敛）
  const collapsedWithin = (id) => {
    let cur = $(id);
    while (cur && cur !== doc.body) {
      if (cur.classList.contains('bf-ph-collapsed')) return true;
      cur = cur.parentElement;
    }
    return false;
  };
  check('带"未加载图片"的骨架也被收敛（不能因为有 img 就放过）',
    collapsedWithin('ph3'), $('ph3').className);
  check('嵌在 .floor-single-card 里的空卡片也能收敛（往上找网格，不只看直接父元素）',
    collapsedWithin('ph4'), $('ph4').className);
  check('又高又空的容器只隐身、保留高度（避免页面高度骤变）',
    $('tallPh').classList.contains('bf-ph-muted') && !$('tallPh').classList.contains('bf-ph-collapsed'),
    $('tallPh').className);
  check('真实卡片不会被误判成占位项（即使图片尚未加载）',
    !$('realCard').classList.contains('bf-ph-collapsed') && !$('realCard').classList.contains('bf-ph-muted'),
    $('realCard').className);

  // 图片加载完成后的占位项不应再被收敛
  // （改 naturalWidth 不会触发 DOM 变更，因此要等一次定时复核：tick 为 1.2s）
  const imgInPh3 = $('ph3').querySelector('img');
  Object.defineProperty(imgInPh3, 'naturalWidth', { value: 320, configurable: true });
  check('占位项里的图片加载完成后不再被收敛',
    await waitFor(() => !collapsedWithin('ph3'), 4500), $('ph3').className);

  await pushSettings({ mode: 'mask', keywords: [], hideKeepSlot: false });
  check('切回遮蔽模式后占位项标记被清除', doc.querySelectorAll('.bf-ph-collapsed, .bf-ph-muted').length === 0);
  // 保留位置模式不应该去动占位项（页面不重排，没有被顶上来的东西）
  await pushSettings({ mode: 'hide', hideKeepSlot: true, keywords: ['剧透'] });
  check('保留位置模式下不触碰占位项', doc.querySelectorAll('.bf-ph-collapsed, .bf-ph-muted').length === 0);
  await pushSettings({ mode: 'mask', keywords: [], hideKeepSlot: true });

  console.log('\n[10c] 外层"边框 + 阴影"容器必须一起隐藏（用户反馈的阴影占位符残留）');
  await pushSettings({ mode: 'mask', keywords: ['剧透警告的直播丁'], hideKeepSlot: true });
  check('分区推广卡片本体被遮蔽', $('frameInner').classList.contains('bf-blocked'), $('frameInner').className);

  await pushSettings({ mode: 'hide', hideKeepSlot: true, keywords: ['剧透警告的直播丁'] });
  check('保留位置模式下：外层容器被标记 bf-hide-slot（连同边框与阴影一起消失）',
    $('frameHost').classList.contains('bf-hide-slot'), $('frameHost').className);
  check('保留位置模式下：卡片本体不再需要单独隐藏', $('frameInner').classList.contains('bf-blocked'));

  await pushSettings({ hideKeepSlot: false });
  check('前移补位模式下：外层容器被标记 bf-hide（整个网格项移除，不留空框）',
    $('frameHost').classList.contains('bf-hide') && !$('frameHost').classList.contains('bf-hide-slot'),
    $('frameHost').className);
  check('前移补位模式下：外层容器不会残留 bf-hide-slot', !$('frameBox').classList.contains('bf-hide-slot'));

  // 带灰底的大块：只隐藏里面的卡片的话，灰底会露出来
  await pushSettings({ mode: 'hide', hideKeepSlot: true, keywords: ['轮播推荐位的视频'] });
  check('带灰底的大块里卡片被隐藏', $('swipeCard').classList.contains('bf-blocked'), $('swipeCard').className);
  check('【关键】灰底容器本身也被一起隐藏（否则露出一块灰色区块）',
    $('swipeHost').classList.contains('bf-hide-slot'), $('swipeHost').className);
  await pushSettings({ hideKeepSlot: false });
  check('前移补位模式下灰底容器同样被移除', $('swipeHost').classList.contains('bf-hide'), $('swipeHost').className);

  await pushSettings({ mode: 'mask', hideKeepSlot: true, keywords: [] });
  check('解除屏蔽后外层容器上的类被清除',
    !$('frameHost').classList.contains('bf-hide') && !$('frameHost').classList.contains('bf-hide-slot'),
    $('frameHost').className);

  console.log('\n[10d] 外层容器必须「真的」被隐藏（按浏览器算出来的样式判定，不看类名）');
  console.log('      —— 回归：卡片没了、带边框的白色盒子还留在页面上（占位符没删干净）');
  const cs = (el) => win.getComputedStyle(el);

  // 1) 分区徽标 .badge > .floor-title（文案「番剧」）绝不能被当成视频标题
  //    开启番剧分区开关 → 这张卡片会被通用识别扫到（真实页面同理），命中原因必须是「分区」而不是「关键词」
  await pushSettings({ mode: 'mask', hideKeepSlot: true, keywords: ['番剧'], blockTypes: { bangumi: true } });
  check('徽标文案「番剧」不会作为关键词命中（命中原因是分区而不是屏蔽词）',
    blocked('badgeInner') && $('badgeInner').dataset.bfKind === 'type', $('badgeInner').dataset.bfKind);

  // 2) 关掉分区开关后，靠真实标题（而不是徽标文案）命中整张卡片
  await pushSettings({ keywords: ['我准备好了'], blockTypes: {} });
  check('【关键】分区推荐卡片按真实标题命中，被屏蔽的是卡片本体 .floor-card-inner',
    blocked('badgeInner') && $('badgeInner').dataset.bfKind === 'keyword',
    $('badgeInner').className + ' / kind=' + $('badgeInner').dataset.bfKind);
  check('封面链接不会被单独当成一张卡片（不带 data-bf-card、不带 bf-blocked）',
    !$('badgeLink').dataset.bfCard && !$('badgeLink').classList.contains('bf-blocked'),
    ($('badgeLink').getAttribute('class') || '(无 class)') + ' / bfCard=' + $('badgeLink').dataset.bfCard);
  check('整卡只生成一个遮罩，且挂在卡片本体上',
    $('badgeInner').querySelectorAll(':scope > .bf-mask').length === 1 &&
    !$('badgeLink').querySelector('.bf-mask'));

  // 3) 保留位置：外层盒子（边框 + 阴影）与背后的灰色垫层一起隐身，但布局盒留着
  await pushSettings({ mode: 'hide', hideKeepSlot: true });
  check('保留位置：卡片本体算出来是 visibility:hidden',
    cs($('badgeInner')).visibility === 'hidden', cs($('badgeInner')).visibility);
  check('【关键】保留位置：外层带边框 + 阴影的盒子 visibility:hidden（不再残留白色空框）',
    cs($('badgeBox')).visibility === 'hidden', cs($('badgeBox')).visibility);
  check('【关键】保留位置：网格项 visibility:hidden（.layer / .layer.tiny 两块灰条一起消失）',
    cs($('badgeHost')).visibility === 'hidden', cs($('badgeHost')).visibility);
  check('保留位置：布局盒仍然占位（display 不是 none，页面不重排）',
    cs($('badgeHost')).display !== 'none', cs($('badgeHost')).display);

  // 4) 移除位置：整个网格项 display:none，后面的内容前移补位
  await pushSettings({ hideKeepSlot: false });
  check('移除位置：卡片本体算出来是 display:none',
    cs($('badgeInner')).display === 'none', cs($('badgeInner')).display);
  check('【关键】移除位置：外层盒子不再占位（display:none，前移补位才成立）',
    cs($('badgeHost')).display === 'none', cs($('badgeHost')).display);

  // 5) 老 fixture（直播楼层）同样按算出来的样式复核一遍
  await pushSettings({ mode: 'hide', hideKeepSlot: true, keywords: ['剧透警告的直播丁'], blockTypes: {} });
  check('保留位置：直播楼层的外层 .floor-card 真的隐身',
    cs($('frameHost')).visibility === 'hidden' && cs($('frameBox')).visibility === 'hidden',
    cs($('frameHost')).visibility + ' / ' + cs($('frameBox')).visibility);
  await pushSettings({ hideKeepSlot: false });
  check('移除位置：直播楼层的外层 .floor-card 不再占位',
    cs($('frameHost')).display === 'none', cs($('frameHost')).display);

  // 6) 解除屏蔽后必须恢复可见
  await pushSettings({ mode: 'mask', hideKeepSlot: true, keywords: [], blockTypes: {} });
  check('解除屏蔽后外层盒子恢复可见',
    cs($('badgeHost')).visibility === 'visible' && cs($('frameHost')).visibility === 'visible',
    cs($('badgeHost')).visibility + ' / ' + cs($('frameHost')).visibility);

  // 8) 直播推广卡片的标题里带「直播中」角标（实测 8 个后代元素），不能因此识别不出来
  await pushSettings({ mode: 'mask', hideKeepSlot: true, keywords: [], blockTypes: { live: true } });
  check('【关键】带「直播中」角标的直播卡片能被识别并屏蔽（标题元素多也不影响）',
    blocked('liveTagInner') && $('liveTagInner').dataset.bfType === 'live',
    $('liveTagInner').className + ' / type=' + $('liveTagInner').dataset.bfType);
  check('直播卡片的封面链接没有被当成一张卡片',
    !$('liveTagLink').dataset.bfCard && !$('liveTagLink').classList.contains('bf-blocked'));

  // 9) 分区推广按封面徽标分类：番剧 / 国创 / 综艺 / 电影 各自独立，赛事开关真的有效
  console.log('\n[10e] 分区推广按封面徽标分类（回归：番剧连带屏蔽、赛事点了没反应）');
  const promoIds = ['tBangumi', 'tGuochuang', 'tVariety', 'tMovie', 'tMatch'];
  const blockedList = () => promoIds.filter((id) => blocked(id)).join(',') || '(无)';

  await pushSettings({ mode: 'mask', hideKeepSlot: true, keywords: [], blockTypes: { bangumi: true } });
  check('开「番剧」只屏蔽番剧卡片（链接同样是 /bangumi/ 的国创/综艺/电影不受影响）',
    blocked('tBangumi') && !blocked('tGuochuang') && !blocked('tVariety') && !blocked('tMovie') && !blocked('tMatch'),
    blockedList());
  check('番剧卡片的类型标记为 bangumi', $('tBangumi').dataset.bfType === 'bangumi', $('tBangumi').dataset.bfType);
  check('番剧卡片的遮蔽文案带上分区名「番剧」', maskText($('tBangumi')).indexOf('番剧') !== -1, maskText($('tBangumi')));

  await pushSettings({ blockTypes: { bangumi: false, guochuang: true } });
  check('开「国创」只屏蔽国创卡片', blocked('tGuochuang') && blockedList() === 'tGuochuang', blockedList());
  check('国创卡片的类型标记为 guochuang', $('tGuochuang').dataset.bfType === 'guochuang', $('tGuochuang').dataset.bfType);

  await pushSettings({ blockTypes: { guochuang: false, variety: true } });
  check('开「综艺」只屏蔽综艺卡片', blocked('tVariety') && blockedList() === 'tVariety', blockedList());

  await pushSettings({ blockTypes: { variety: false, movie: true } });
  check('开「电影」只屏蔽电影卡片', blocked('tMovie') && blockedList() === 'tMovie', blockedList());

  await pushSettings({ blockTypes: { movie: false, live: true } });
  check('开「直播」不会连带屏蔽带赛事徽标的卡片（按徽标分类，不看链接）',
    !blocked('tMatch') && blockedList() === '(无)', blockedList());

  await pushSettings({ blockTypes: { live: false, match: true } });
  check('【回归】开「赛事」能屏蔽赛事卡片（它的链接是直播间）',
    blocked('tMatch') && blockedList() === 'tMatch', blockedList());
  check('赛事卡片的类型标记为 match（不是 live）', $('tMatch').dataset.bfType === 'match', $('tMatch').dataset.bfType);
  check('赛事卡片的遮蔽文案带上分区名「赛事」', maskText($('tMatch')).indexOf('赛事') !== -1, maskText($('tMatch')));

  await pushSettings({ blockTypes: {} });
  check('全部关掉后都恢复显示', blockedList() === '(无)', blockedList());

  // 7) 懒加载插入的推广卡片：只配置屏蔽词、分区开关全关，也应该被自动扫到并屏蔽
  await pushSettings({ mode: 'mask', hideKeepSlot: true, keywords: ['我准备好了'], blockTypes: {} });
  const promo = doc.createElement('div');
  promo.className = 'floor-single-card';
  promo.setAttribute('data-w', '238');
  promo.setAttribute('data-h', '248');
  promo.innerHTML = '<div class="single-card floor-card" style="border:1px solid #e3e5e7;background:#fff">' +
    '<div class="floor-card-inner" id="promoInner" data-w="238" data-h="224">' +
    '<div class="cover-container" data-w="238" data-h="134">' +
    '<a href="//www.bilibili.com/bangumi/play/ep999"><img src="p.jpg"></a>' +
    '<div class="badge"><span class="floor-title">番剧</span></div>' +
    '</div>' +
    '<div class="info-container" data-w="238" data-h="90">' +
    '<p class="title" title="我准备好了，随时可以出发">我准备好了，随时可以出发</p></div>' +
    '</div></div>';
  doc.querySelector('main').appendChild(promo);
  check('懒加载插入的推广卡片能自动扫到并按标题屏蔽（分区开关全关也一样）',
    await waitFor(() => !!$('promoInner') && $('promoInner').classList.contains('bf-blocked')),
    $('promoInner') ? $('promoInner').className : '(未找到)');
  check('该卡片被屏蔽的是卡片本体，徽标文案依然没被当成标题',
    !!$('promoInner').querySelector(':scope > .bf-mask') &&
    !$('promoInner').querySelector('.badge').classList.contains('bf-blocked'));

  console.log('\n[11] 顶栏与横幅不被误伤');
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
  check('新卡片被 MutationObserver 自动扫描并屏蔽',
    await waitFor(() => $('c9').classList.contains('bf-blocked')), '未被屏蔽');

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

  console.log('\n[16] 完全隐藏 → 遮蔽 切换时不能被尺寸安全阀卡住（回归）');
  // 模拟"有真实排版引擎"的环境：body 有非零尺寸
  doc.body.setAttribute('data-w', '1400');
  doc.body.setAttribute('data-h', '900');
  await pushSettings({ mode: 'hide', hideKeepSlot: false, keywords: ['正常的一个视频'] });
  check('完全隐藏（移除位置）下该卡片被隐藏', $('c2').classList.contains('bf-hide'), $('c2').className);
  // 模拟 display:none 之后尺寸变为 0
  $('c2').removeAttribute('data-w');
  $('c2').removeAttribute('data-h');
  // 换成另一个同样命中的关键词 → 命中原因（key）发生变化
  await pushSettings({ keywords: ['正常'] });
  check('命中词变化后仍处于隐藏状态', $('c2').classList.contains('bf-hide'));
  await pushSettings({ mode: 'mask' });
  check('【回归】切回遮蔽模式后卡片恢复（不再一直隐藏）',
    !$('c2').classList.contains('bf-hide') && $('c2').classList.contains('bf-blocked'),
    $('c2').className);
  check('恢复后遮罩重新出现', !!$('c2').querySelector(':scope > .bf-mask'));
  // 还原
  $('c2').setAttribute('data-w', '240');
  $('c2').setAttribute('data-h', '210');
  doc.body.removeAttribute('data-w');
  doc.body.removeAttribute('data-h');
  await pushSettings({ mode: 'mask', keywords: [] });
  check('还原后卡片正常显示', !$('c2').classList.contains('bf-blocked'));

  console.log('\n[17] 深色模式适配');
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
