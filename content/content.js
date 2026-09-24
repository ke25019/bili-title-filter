/**
 * B站屏蔽助手 - 内容脚本
 * （版本号只写在 manifest.json 里，代码里不再重复，免得哪天忘了同步）
 * ---------------------------------------------------------------
 * 功能：
 *  1. 按用户自定义的「标题屏蔽词」屏蔽视频卡片
 *  2. 两种屏蔽方式：
 *     - mask：把封面 + 标题合成一整块「根据您的屏蔽词已将此视频屏蔽」区域
 *             （鼠标悬停可临时查看该视频）
 *     - hide：直接从页面上移除，就像这个视频没出现过
 *  3. 分区推广屏蔽（卡片级 blockTypes）：屏蔽该分区的每一张推广卡片
 *  4. 首页顶部轮播横幅屏蔽（blockBanner）：独立开关，只作用于首页那一块
 *  5. 标题栏附近的悬浮面板可自由拖动，位置自动记忆
 *  6. 自动适配 B 站 web 端深色模式
 *
 * 分区识别策略（全部结论来自真实浏览器实测，不依赖单一 class）：
 *   a) 先看卡片内链接指向哪个站（live.bilibili.com / bangumi / cheese ...）
 *   b) 已知卡片类名优先；BEM 子元素回推到块根（xxx__el → .xxx）
 *   c) 都不是时，向上找**同时包含标题与封面**的那一层作为卡片
 *   d) 任何一步无法确认就跳过 —— 宁可不屏蔽，也绝不乱遮导致页面空白
 */
(function () {
  'use strict';

  if (window.__BF_CONTENT_LOADED__) return;
  window.__BF_CONTENT_LOADED__ = true;

  var DEFAULTS = window.BF_DEFAULTS;
  var TYPES = window.BF_TYPES;
  var normalize = window.bfNormalize;

  /* ------------------------------------------------------------------
   * 页面选择器
   * ------------------------------------------------------------------ */

  /**
   * 广告位容器（实测结构，逐字来自使用者贴的 Copy outerHTML）：
   *   - 播放器区的贴片广告（"gg" 就是"广告"，B 站自己这么命名）：
   *     #slide_ad.slide-ad-exp > .slide-gg > .van-slide.item-box > .item
   *       > .ad-report.link > a.ad-report-inner > img
   *       + img.gg-pic（广告角标） + .close-btn > i.van-icon-guanbi（关闭按钮）
   *   - 右栏广告卡片：
   *     .video-card-ad-small > .ad-report-inner > a.ad-report > .ad-floor-cover-img > img
   *
   * 为什么要单独列出来：这些块既不在下面那套视频卡片类名里、又**没有标题**，
   * 所以走不了「命中链接 + 标题 + 封面」的通用识别 —— 实测一个都收不上来，
   * 「广告」分区开关对它们完全无效（有人反馈过：播放页广告怎么都屏蔽不掉）。
   * 注意这里**不并入 CARD_SELECTOR**：广告位本身往往只装着图片，
   * 而卡片上的标题、UP 名、「广告」角标挂在外层容器上，只遮广告位等于没遮干净
   * （反馈原文：只有一部分被挡住）。所以广告位统一走 scanAdSlots()，
   * 由 adSlotTarget() 先把它收到「整卡外壳」再处理。
   */
  var AD_SLOT_SELECTOR = [
    '#slide_ad',
    '.slide-ad-exp',
    '.slide-gg',
    '.slide-ad',
    '.video-card-ad-small',
    '[class*="ad-report"]',
    '[class*="ad-floor"]'
  ].join(',');

  /**
   * 「整卡外壳」的尺寸上限：广告位往上收的时候，超过这个尺寸就停。
   * 取 600×560 的依据：右栏广告卡实测 350 宽、连标题一起约 250 高；
   * 而播放器那层的容器是 1130×640 起步 —— 宽度这条上限本身就挡住了
   * "把整个播放器当成广告卡遮掉"这种最坏情况。
   */
  var AD_FRAME_MAX_W = 600;
  var AD_FRAME_MAX_H = 640;

  /**
   * 「整卡外壳」允许的子元素个数上限。广告卡一般只有"图片块 + 文字块"两三个子节点，
   * 而弹幕列表、推荐流这类面板动辄几十个 —— 这条是防止一路收进面板里的兜底判据。
   */
  var AD_FRAME_MAX_CHILDREN = 6;

  /**
   * 这些容器里装的是页面功能（弹幕列表、播放器），不是"卡片外面那层空壳"。
   * 只要某一层命中了它们、或者里面装着它们，这一层就绝不能再被当成空壳一起隐藏。
   *
   * 实测（2026-09 播放页，层级逐层核对过）：
   *   .right-container > .right-container-inner
   *     ├ .video-pod-above-modules > .video-pod-above-modules__inner
   *     │     ├ #danmukuBox.danmaku-box > .danmaku-wrap   ← 弹幕列表
   *     │     └ #slide_ad.slide-ad-exp                    ← 贴片广告
   *     └ .rcmd-tab
   *          ├ .recommend-list-v1 > .rec-list > .video-page-card-small …
   *          └ .ad-report.ad-floor-exp.right-bottom-banner
   * 也就是：广告和弹幕列表是同一层父级下的兄弟节点。屏蔽广告时若一路往上
   * 把父层当空壳隐藏，弹幕列表就会跟着一起没了。
   *
   * 这条判据来自另一位贡献者发的 1.5.6 构建（他当时的做法是保护这些区域），
   * 与本文件里「整卡外壳」那套规则互补：那套管遮罩遮哪一块，这套管完全隐藏时
   * 别把功能区域一起收走。
   */
  var PROTECTED_REGION_SELECTOR = [
    '#danmukuBox',
    '.danmaku-box',
    '.danmaku-wrap',
    /* 只认「弹幕列表这个面板」的类名，不认单条弹幕（danmaku-item 这类）：
       弹幕列表里的推广条本身就是一条弹幕，它得能当广告卡被遮（仓库用例有这一条）。 */
    '[class*="danmaku-list"]',
    '[class*="danmaku-panel"]',
    '[class*="danmaku-container"]',
    '#bilibili-player',
    '.bpx-player-container',
    '.bilibili-player',
    '.video-pod-above-modules',
    '.video-pod-above-modules__inner'
  ].join(',');

  /** 视频 / 推广卡片容器（已知类名，实测于 2025 年 B 站首页 / 搜索页 / 播放页） */
  var CARD_SELECTOR = [
    '.bili-video-card',
    '.feed-card',
    '.bili-feed-card',
    '.bili-live-card',
    '.video-card',
    '.video-page-card-small',
    '.video-page-special-card-small',
    '.bili-dyn-card-video',
    '.bili-dyn-card-article',
    '.rank-item',
    '.spread-module',
    '.small-item',
    '.live-card',
    '.bili-bangumi-card',
    '.bili-movie-card',
    '.bili-cheese-card',
    '.bili-manga-card',
    '.bili-note-card',
    '.bili-article-card',
    '.bili-opus-card',
    /* 分区推广楼层的卡片本体（实测结构：.floor-card > .floor-card-inner）。
       以前特意不写死在这里，靠「命中链接 + 标题 + 封面」的通用识别来收 ——
       但那只有在这张卡片的链接命中某个分区时才成立。实测 2026-09 的赛事推广卡片
       链接变成了**普通视频**（//www.bilibili.com/video/BV1TbbC65EZ9/），
       没有任何分区链接特征，于是通用识别一个都收不到，卡片从来没进过屏蔽流程
       （反馈里「赛事」开关点了没反应、而且只有赛事不行，就是这个原因）。
       楼层卡片的结构和尺寸都很稳定（实测 238×224），按类名收最可靠。 */
    '.floor-card-inner',
    '.anime-list-item'
  ].join(',');

  /** 标题所在元素（按优先级排列） */
  var TITLE_SELECTORS = [
    '.bili-video-card__info--tit',
    '.bili-live-card__info--tit',
    '.video-page-card-small__info__title',
    '.video-page-special-card-small__title',
    '.bili-bangumi-card__info--title',
    '.bili-movie-card__info--title',
    '.bili-cheese-card__info--title',
    '.bili-manga-card__info--title',
    '.bili-article-card__info--title',
    '.anime-list-item-title',
    '.floor-title',
    '.video-name',
    '.title',
    '.r-info .title',
    '.info .title',
    '.content .title',
    '[class*="--tit"]',
    '[class*="__tit"]',
    '[class*="card-title"]',
    '[class*="item-title"]',
    'h3[title]',
    'a[title]'
  ];

  /** UP 主名称所在元素 */
  var UP_SELECTORS = [
    '.bili-video-card__info--author',
    '.bili-video-card__info--owner',
    '.bili-live-card__info--uname',
    '.up-name',
    '.name',
    '.bili-video-card__info--bottom .name'
  ];

  /** 横幅 / 轮播属于"板块推广位"，只由板块级开关负责，卡片级不碰 */
  var BANNER_EXCLUDE = '.carousel-area, .carousel-container, [class*="carousel"], [class*="banner"]';

  /**
   * 顶栏 / 导航区域。**任何屏蔽路径都不许碰这里**：
   * 它既不是视频卡片也不是推广位，是站点自己的导航，遮住它就是"把首页/番剧/直播这些入口挡住了"
   * （反馈过：播放页开了「广告」之后顶栏被遮）。
   *
   * 除了老的类名，这里补上了 2026-09 实测到的现役顶栏结构（抓首页服务端 HTML 核对过）：
   *   .bili-header.bili-header--large > .bili-header__menu.bili-header__bar
   *     > .left-entry > .left-entry-main > .left-entry__item.v-popover-wrap > a.left-entry__item-trigger
   *     > .center-search-container > .nav-search-input …
   *     > .right-entry > .right-entry__item …
   * 导航项是 .channel-link（88 个），所以老的 .default-entry / .nav-link 其实已经不在了，
   * 只留老类名会漏掉现役结构。
   */
  var NAV_EXCLUDE = [
    'header',
    'nav',
    '#bili-filter-host',
    '#nav-searchform',
    '.bili-header',
    '.mini-header',
    '#biliMainHeader',
    '.international-header',
    '.center-search-container',
    '.channel-icons',
    '.channel-items__left',
    '.channel-items__right',
    '.channel-link',
    '.channel-entry',
    '.channel-panel',
    '.default-entry',
    '.nav-link',
    '.left-entry',
    '.right-entry',
    '.v-popup',
    '.v-popup-wrap',
    '.popover',
    '.bili-dropdown',
    /* 现役顶栏（实测 2026-09） */
    '.bili-header__menu',
    '.bili-header__bar',
    '.bili-header__banner',
    '.left-entry-main',
    '.left-entry__item',
    '.left-entry__item-trigger',
    '.right-entry__item',
    '.nav-search',
    '.nav-search-input',
    '.header-upload-entry',
    /* 实测补充：这两个区域里藏着 0×0 的隐藏推广链接，曾被误判成卡片 */
    '.header-channel',
    '.palette-button-outer',
    '.palette-button-inner',
    /* 登录相关区域：登录卡片里的链接会命中「其他推广」的域名规则，
       把整块登录面板当成推广屏蔽掉（有人反馈过），这里明确排除 */
    '[class*="login"]',
    '[id*="login"]',
    '.passport',
    '.bili-login'
  ].join(',');

  /**
   * 这个元素是不是落在"绝对不许动"的站点区域里（顶栏 / 导航 / 登录面板）。
   * 所有屏蔽路径（关键词、分区、广告位、徽标发现、外层空壳收敛）都要先过这一关。
   */
  function isChromeRegion(el) {
    return !!(el && el.closest && el.closest(NAV_EXCLUDE));
  }

  /** 卡片容器语义提示（仅作为最末位的兜底提示，不再作为主要判据） */
  var CARD_HINT_RE = /card|item|module|entry|video|live|bangumi|pgc|media|floor|short|cover/i;

  var MASK_ICON_SVG =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>' +
    '<path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>' +
    '<path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/>' +
    '<line x1="1" y1="1" x2="23" y2="23"/></svg>';

  /* ------------------------------------------------------------------
   * 运行时状态
   * ------------------------------------------------------------------ */

  var settings = normalize(null);
  var matcher = null;
  var isDark = false;
  var sessionBlocked = 0;
  var totalBlocked = 0;

  var dirtyCards = new Set();
  var trackedCards = new Set();
  var hoverBound = new WeakSet();
  var flushTimer = null;
  var pendingFullScan = false;
  var lastScanAt = 0;
  var lastSectionScanAt = 0;
  var lastPlaceholderCheck = 0;

  var hostEl = null;
  var shadow = null;
  var panelOpen = false;
  var userPositioned = false;

  /* ------------------------------------------------------------------
   * 工具函数
   * ------------------------------------------------------------------ */

  function log() {
    if (!settings.debug) return;
    var args = Array.prototype.slice.call(arguments);
    args.unshift('[B站屏蔽助手]');
    console.log.apply(console, args);
  }

  function storageGet(area, keys) {
    return new Promise(function (resolve) {
      try {
        var maybe = chrome.storage[area].get(keys);
        if (maybe && typeof maybe.then === 'function') {
          maybe.then(function (v) { resolve(v || {}); }, function () { resolve({}); });
        } else {
          chrome.storage[area].get(keys, function (v) { resolve(v || {}); });
        }
      } catch (e) {
        resolve({});
      }
    });
  }

  function storageSet(area, obj) {
    return new Promise(function (resolve) {
      try {
        var maybe = chrome.storage[area].set(obj);
        if (maybe && typeof maybe.then === 'function') {
          maybe.then(function () { resolve(true); }, function () { resolve(false); });
        } else {
          chrome.storage[area].set(obj, function () { resolve(true); });
        }
      } catch (e) {
        resolve(false);
      }
    });
  }

  /** 计算背景色亮度，用于兜底判断深色 / 浅色 */
  function bgLuminance(color) {
    if (!color) return null;
    var m = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+))?\s*\)/i.exec(color);
    if (!m) return null;
    var a = m[4] === undefined ? 1 : parseFloat(m[4]);
    if (a < 0.15) return null;
    var r = parseFloat(m[1]) / 255;
    var g = parseFloat(m[2]) / 255;
    var b = parseFloat(m[3]) / 255;
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  function normalizeHref(href) {
    return String(href || '').replace(/[?#].*$/, '').replace(/\/+$/, '');
  }

  function getType(key) {
    for (var i = 0; i < TYPES.length; i++) {
      if (TYPES[i].key === key) return TYPES[i];
    }
    return null;
  }

  function typeLabel(key) {
    var t = getType(key);
    return t ? t.label : key;
  }

  /* ------------------------------------------------------------------
   * 屏蔽词匹配
   * ------------------------------------------------------------------ */

  function rebuildMatcher() {
    var keywords = (settings.keywords || []).filter(function (k) {
      return k && k.trim();
    });

    var compiled = keywords.map(function (raw) {
      var kw = raw.trim();
      if (settings.useRegex) {
        try {
          return { raw: kw, re: new RegExp(kw, settings.caseSensitive ? '' : 'i') };
        } catch (e) {
          log('正则表达式无效，已按普通文本处理：', kw);
          return { raw: kw, plain: kw };
        }
      }
      return { raw: kw, plain: settings.caseSensitive ? kw : kw.toLowerCase() };
    });

    matcher = function match(text) {
      if (!text) return null;
      var hay = String(text);
      var hayLower = settings.caseSensitive ? hay : hay.toLowerCase();
      for (var i = 0; i < compiled.length; i++) {
        var c = compiled[i];
        if (c.re) {
          if (c.re.test(hay)) return c.raw;
        } else if (hayLower.indexOf(c.plain) !== -1) {
          return c.raw;
        }
      }
      return null;
    };
  }

  /* ------------------------------------------------------------------
   * 卡片解析
   * ------------------------------------------------------------------ */

  function isNestedCard(el) {
    var parent = el.parentElement;
    if (!parent) return false;
    return !!parent.closest('[data-bf-card]');
  }

  function textOf(el) {
    if (!el) return '';
    var t = el.getAttribute && el.getAttribute('title');
    if (t && t.trim()) return t.trim();
    return (el.textContent || '').replace(/\s+/g, ' ').trim();
  }

  /**
   * 分区徽标（封面左上角那个「番剧 / 直播」小标签）绝不能被当成视频标题。
   *
   * 实测证据（用户从首页「分区推荐」卡片 Copy outerHTML）：
   *   <a href="//www.bilibili.com/bangumi/play/ep468949">
   *     <div class="cover-shim">…封面…</div>
   *     <div class="badge"><svg class="icon-title"/><span class="floor-title">番剧</span></div>
   *   </a>
   * 徽标里用的正是 .floor-title —— 与标题选择器同名，而且就在封面链接内部。
   * 不排除它会导致两个真实 bug：
   *   1) resolveCardTarget 会在**封面链接**上就找到"标题 + 封面"，把封面链接当成一整张卡片；
   *   2) getTitle 会拿「番剧」两个字去比对屏蔽词，卡片真正的标题被彻底忽略。
   */
  /**
   * 徽标外面那层容器（`.badge` 这类）。B 站换过一次类名（反馈里「赛事」第二次失效
   * 就是这个原因），所以这里连同义类名一起认；两条兜底在 isBadgeLabel 里。
   */
  var BADGE_WRAP_SELECTOR = '.badge, [class*="badge"], [class*="cover-tag"], [class*="corner"]';

  /** 徽标所在的容器（`.badge` 这种） */
  var BADGE_SELECTOR = '.badge, [class*="badge"]';

  /**
   * 徽标的兜底来源：B 站改过一次这层容器的类名，只认 .badge 的话，
   * 「赛事」这类卡片就会掉回按链接判定（赛事卡片的链接是直播间 → 被算成直播），
   * 结果「赛事」开关点了没反应（反馈过两次）。
   * 封面上那个短文案（实测都很短：番剧/国创/综艺/电影/课堂/直播/赛事…）
   * 只要落在封面区域里、且不超过 6 个字，就仍然当徽标用；
   * 长度这一条是为了不把真正的标题（「赛事直播预约」这种）当成徽标。
   */
  var BADGE_FALLBACK_SELECTOR = [
    '.floor-title',
    '[class*="floor-title"]',
    '[class*="cover-tag"]',
    '[class*="cover"] [class*="tag"]',
    '[class*="corner"]'
  ].join(',');

  var BADGE_COVER_SELECTOR = '.cover-container, [class*="cover"], [class*="pic"], [class*="img"]';

  var BADGE_MAX_LEN = 6;

  function cleanText(el) {
    return ((el && el.textContent) || '').replace(/\s+/g, '').trim();
  }

  /**
   * 这个元素是不是"封面角标"（而不是卡片标题）。
   *
   * 判据一：在外面那层徽标容器里。
   * 判据二（兜底）：落在封面区域里、而且文案很短 —— 实测徽标文案都是
   * 番剧/国创/综艺/电影/课堂/直播/赛事 这种 2~3 个字，而卡片标题不会长在封面上。
   * 为什么必须认出来：`.floor-title` 同时是"标题选择器"，一旦被当成标题，
   * 通用识别会在封面这一层就认定"标题 + 封面都有了"，于是只遮住封面那一块，
   * 卡片下方的标题和 UP 名留在页面上（就是"只挡住一半"那个老问题）。
   */
  function isBadgeLabel(el) {
    if (!el || !el.closest) return false;
    if (el.closest(BADGE_WRAP_SELECTOR)) return true;
    if (!el.closest(BADGE_COVER_SELECTOR)) return false;
    var t = cleanText(el);
    return !!t && t.length <= BADGE_MAX_LEN;
  }

  function getTitle(card) {
    for (var i = 0; i < TITLE_SELECTORS.length; i++) {
      var el = card.querySelector(TITLE_SELECTORS[i]);
      if (!el) continue;
      var t = textOf(el);
      if (t && !isBadgeLabel(el)) return t;
    }
    var anchor = card.querySelector('a[title]');
    if (anchor) {
      var at = anchor.getAttribute('title');
      if (at && at.trim() && !isBadgeLabel(anchor)) return at.trim();
    }
    var own = card.getAttribute('title');
    if (own && own.trim()) return own.trim();
    return '';
  }

  function getUpName(card) {
    for (var i = 0; i < UP_SELECTORS.length; i++) {
      var el = card.querySelector(UP_SELECTORS[i]);
      if (!el) continue;
      var t = textOf(el);
      if (t) return t;
    }
    return '';
  }

  /** UP 主主页链接里的那串数字 ID（卡片里指向 space.bilibili.com/<id> 的链接） */
  function getUpUid(card) {
    var a = card.querySelector('a[href*="space.bilibili.com/"]');
    if (!a) return '';
    var m = /space\.bilibili\.com\/(\d+)/.exec(a.getAttribute('href') || '');
    return m ? m[1] : '';
  }

  /**
   * 白名单命中判定。
   *
   * 名单项与 UP 名字比对，**按"包含"匹配**（忽略大小写，双向都算）：
   * 屏蔽词本身就是按包含匹配的，如果白名单要求完全一致，就会出现
   * 「关键词填「某UP」、白名单填「某UP主」→ 还是被屏蔽」这种绕不过去的情况
   * （站内搜索结果页尤其容易撞上，因为卡片上的名字写法和首页不一定完全一样）。
   * 纯数字的项仍按主页数字 ID 精确比对。
   * 命中之后关键词和分区开关都不再作用于这张卡片 —— 白名单就是"这个 UP 永远别屏蔽"。
   */
  function isWhitelisted(card) {
    var list = settings.whitelist || [];
    if (!list.length) return false;
    var name = getUpName(card).trim().toLowerCase();
    var uid = getUpUid(card);
    for (var i = 0; i < list.length; i++) {
      var w = String(list[i] == null ? '' : list[i]).trim();
      if (!w) continue;
      if (uid && w === uid) return true;
      if (!name) continue;
      var wl = w.toLowerCase();
      if (wl === name || name.indexOf(wl) !== -1 || wl.indexOf(name) !== -1) return true;
    }
    return false;
  }

  /** 统计元素内「多少个不同的」该类型链接（同一张卡片的封面+标题链接算 1 个） */
  function countDistinctEntries(el, hrefRe) {
    if (!el || !el.querySelectorAll) return 0;
    var anchors = el.querySelectorAll('a[href]');
    var seen = Object.create(null);
    var n = 0;
    for (var i = 0; i < anchors.length; i++) {
      var href = anchors[i].getAttribute('href') || '';
      if (!hrefRe.test(href)) continue;
      var key = normalizeHref(href);
      if (seen[key]) continue;
      seen[key] = 1;
      n++;
      if (n > 8) break;
    }
    return n;
  }

  /** 元素内部「最外层」的已知卡片数量（> 1 说明它是列表容器而不是卡片） */
  function countTopCards(el) {
    if (!el || !el.querySelectorAll) return 0;
    var all = el.querySelectorAll(CARD_SELECTOR);
    var n = 0;
    for (var i = 0; i < all.length; i++) {
      var parent = all[i].parentElement;
      if (!parent || !parent.closest(CARD_SELECTOR)) n++;
      if (n > 1) return n;
    }
    return n;
  }

  /** 在作用域内找到"标题"元素（含自身）。分区徽标上的文字（「番剧」「直播」）不算标题。 */
  function findTitleEl(scope) {
    if (!scope) return null;
    for (var i = 0; i < TITLE_SELECTORS.length; i++) {
      var sel = TITLE_SELECTORS[i];
      if (scope.matches && scope.matches(sel) && isTitleish(scope) && !isBadgeLabel(scope)) return scope;
      if (!scope.querySelector) continue;
      var el = scope.querySelector(sel);
      if (!el) continue;
      if (isBadgeLabel(el)) {
        // 同一个选择器可能还匹配到真正的标题（.floor-title 既是徽标文案、也是楼层标题的类名）
        var list = scope.querySelectorAll(sel);
        el = null;
        for (var k = 0; k < list.length; k++) {
          if (!isBadgeLabel(list[k])) { el = list[k]; break; }
        }
        if (!el) continue;
      }
      if (isTitleish(el)) return el;
    }
    return null;
  }

  /**
   * 标题一般是叶子节点，且文字不会太长。
   *
   * 元素个数上限不能定得太死：实测首页「分区推荐」里的**直播卡片**，
   * 标题 <p class="title"> 里塞着「直播中」角标 ——
   * <div class="living"><picture><source><source><img></picture><span>直播中</span></div>，
   * 一共 8 个后代元素，旧的上限 4 直接把整个标题判掉，卡片因此完全识别不出来
   * （直播推广卡片开了开关也不屏蔽）。所以放宽到 12：
   * 真正的容器配上 150 字的文字上限依然会被排除。
   */
  function isTitleish(el) {
    if (!el) return false;
    var text = (el.textContent || '').replace(/\s+/g, ' ').trim();
    if (!text || text.length > 150) return false;
    if (el.querySelectorAll && el.querySelectorAll('*').length > 12) return false;
    return true;
  }

  /** 作用域内是否有封面图 */
  function hasCoverInside(el) {
    return !!(el.querySelector && el.querySelector('img, picture, [class*="cover"], [class*="image"]'));
  }

  /**
   * 尺寸是否像"一张卡片"。
   * 真实浏览器里严格执行（这正是防止整页被遮蔽的关键）；
   * jsdom 等拿不到尺寸的环境（rect 全为 0）视为"未知"，交给结构判据兜底。
   */
  /**
   * 当前环境是否有真实排版引擎（能给出非零尺寸）。
   * 注意：这里**不做缓存** —— 首次调用可能发生在 body 还没渲染好时，
   * 一旦缓存为 false，尺寸安全阀就会整场失效。
   * 每次只多一次 getBoundingClientRect，代价可忽略。
   */
  function hasLayoutEngine() {
    var r = document.body ? document.body.getBoundingClientRect() : null;
    return !!(r && r.width > 0 && r.height > 0);
  }

  function isPlausibleCardSize(el) {
    if (!el || !el.getBoundingClientRect) return true;
    var r = el.getBoundingClientRect();
    if (!r || (!r.width && !r.height)) {
      // 真实浏览器里 0 尺寸 = 隐藏元素（display:none 等）→ 不要遮蔽它
      return !hasLayoutEngine();
    }
    var vw = window.innerWidth || 1280;
    var vh = window.innerHeight || 800;
    // 上限放宽到"能挡住 B 站首页左上角那个 2 列大块（实测 580×485，约占视口 25%）"，
    // 同时仍然拦得住真正的灾难：整页容器（实测 1401×808）和全宽容器。
    if (r.width > 1200 || r.height > 800) return false;
    if (r.width * r.height > vw * vh * 0.35) return false;
    return true;
  }

  function commonAncestor(a, b) {
    if (!a || !b) return null;
    if (a.contains(b)) return a;
    if (b.contains(a)) return b;
    var el = b.parentElement;
    while (el) {
      if (el.contains(a)) return el;
      el = el.parentElement;
    }
    return null;
  }

  /** 候选容器是否"安全"：不是列表、不装别的卡片、尺寸像卡片 */
  function isSafeCardTarget(el, hrefRe) {
    if (!el || el === document.body || el === document.documentElement) return false;
    if (countDistinctEntries(el, hrefRe) > 1) return false;   // 内含多个同分区条目 → 是列表
    if (countTopCards(el) > 1) return false;                  // 内含别的卡片 → 是容器
    if (!isPlausibleCardSize(el)) return false;               // 尺寸不像一张卡片
    return true;
  }

  /** B 站用 BEM 命名：bili-live-card__image--link 的块根是 bili-live-card */
  function bemRootOf(el) {
    var cls = typeof el.className === 'string' ? el.className : '';
    var m = /(?:^|\s)([a-z0-9-]+?)__/i.exec(cls);
    return m ? m[1] : null;
  }

  /**
   * 推断"该推广条目"对应的卡片容器。
   *
   * 关键点：向上找到第一层**同时包含标题与封面**的祖先，
   * 这样遮蔽区域天然覆盖「封面 + 标题」，与视频卡片的表现一致；
   * 任何一步无法确认就返回 null —— 宁可不屏蔽，也绝不乱遮一通。
   */
  function resolveCardTarget(a, hrefRe) {
    // 1) 已经在已知卡片结构里：取最外层的那张卡片
    var known = a.closest(CARD_SELECTOR);
    if (known) {
      var outer = known;
      while (outer.parentElement && outer.parentElement.matches &&
             outer.parentElement.matches(CARD_SELECTOR) &&
             isSafeCardTarget(outer.parentElement, hrefRe)) {
        outer = outer.parentElement;
      }
      return isSafeCardTarget(outer, hrefRe) ? outer : null;
    }

    // 2) BEM 块根：bili-live-card__image--link -> .bili-live-card
    var root = bemRootOf(a);
    if (root) {
      var byRoot = a.closest('.' + root);
      if (byRoot && hasTitleInside(byRoot) && isSafeCardTarget(byRoot, hrefRe)) return byRoot;
    }

    // 3) 通用推断：向上找同时含「标题」和「封面」的那一层
    var scope = a;
    for (var i = 0; i < 6 && scope && scope !== document.body; i++) {
      if (!isSafeCardTarget(scope, hrefRe)) return null;
      if (findTitleEl(scope) && hasCoverInside(scope)) return scope;
      scope = scope.parentElement;
    }
    return null;
  }

  function hasTitleInside(el) {
    return !!findTitleEl(el);
  }

  /** 该卡片命中的所有具体分区类型（不含 other 兜底） */
  function matchSpecificTypes(card) {
    var hrefs = '';
    var anchors = card.querySelectorAll('a[href]');
    for (var i = 0; i < anchors.length && i < 20; i++) {
      hrefs += ' ' + (anchors[i].getAttribute('href') || '');
    }
    var cls = typeof card.className === 'string' ? card.className : '';
    var hits = [];
    for (var j = 0; j < TYPES.length; j++) {
      var t = TYPES[j];
      if (t.key === 'other') continue;
      if ((t.href && hrefs && t.href.test(hrefs)) || (t.cls && cls && t.cls.test(cls))) hits.push(t.key);
    }
    if (card.querySelector('.bili-video-card__stats--ad, .bili-video-card__info--ad, .ad-report, .video-card-ad-small')) {
      if (hits.indexOf('ad') === -1) hits.push('ad');
    }
    return hits;
  }

  function anchorHrefsMatch(card, hrefRe) {
    var anchors = card.querySelectorAll('a[href]');
    for (var i = 0; i < anchors.length && i < 20; i++) {
      if (hrefRe.test(anchors[i].getAttribute('href') || '')) return true;
    }
    return false;
  }
  /** 卡片封面左上角的分区徽标文字（判据与兜底见上方 isBadgeLabel 的注释） */
  function getBadgeText(card) {
    var box = card.querySelector(BADGE_SELECTOR);
    if (box) {
      var el = box.querySelector('.floor-title') || box;
      var t = cleanText(el);
      if (t) return t;
    }
    var marks = card.querySelectorAll(BADGE_FALLBACK_SELECTOR);
    for (var i = 0; i < marks.length && i < 4; i++) {
      var m = marks[i];
      var txt = cleanText(m);
      if (!txt || txt.length > BADGE_MAX_LEN) continue;
      if (!m.closest(BADGE_COVER_SELECTOR)) continue;   // 必须在封面区域内
      return txt;
    }
    return '';
  }

  /** 这个容器本身是不是广告位（判据见 AD_SLOT_SELECTOR 与下方 PLAYER_BANNER_INNER_SELECTOR） */
  function isAdSlot(el) {
    if (!el || !el.matches) return false;
    if (el.matches(AD_SLOT_SELECTOR)) return true;
    if (isPlayerBannerHost(el)) return true;
    // 「整卡外壳」的身份由 scanAdSlots 在认出来的时候明确标上（bfAdFrame）。
    // 不写成"里面装着广告位就算" —— 那样整个推荐流、整个播放器都可能被认成广告卡。
    return el.dataset ? el.dataset.bfAdFrame === '1' : false;
  }

  /** 量到的尺寸是不是"一张卡片"的量级（拿不到尺寸时一律按否处理） */
  function isCardSizedBox(el, maxW, maxH) {
    var r = el.getBoundingClientRect ? el.getBoundingClientRect() : null;
    if (!r || !r.width || !r.height) return false;
    return r.width <= maxW && r.height <= maxH;
  }

  /**
   * 广告位的"整卡外壳"。
   *
   * 反馈：右栏广告卡只挡住了一部分 —— 图片那块被遮住了，卡片下方的标题、
   * UP 名和「广告」角标还露在页面上。原因是这些文字挂在外层容器上，
   * 而那个外层容器的类名不在任何已知列表里（写死类名必然漏）。
   * 这里的做法是从广告位向上收，收到"仍然只装着这一块广告"的最外层。
   *
   * 停止条件（任一条命中就停，宁可少收一层也不错收一屏）：
   *   ① 这一层是"面板/列表"（弹幕列表、评论区、推荐流、播放器…）——
   *      反馈里"把弹幕列表算进去了"就是这么来的
   *   ② 这一层里还有别的广告位（当前广告位之外的）→ 停。实测右栏就是这个形状：
   *      .video-pod-above-modules__inner 里同时装着 #danmukuBox（弹幕列表）、
   *      空的 #slide_ad 和真正的广告 .video-card-ad-small —— 只有这条能拦住它，
   *      否则遮罩会连弹幕列表一起盖住
   *   ③ 这一层里还有别的真卡片（有标题或有封面）→ 到了推荐列表
   *   ④ 子元素个数超过 6 —— 广告卡只有两三个子节点，列表不会只有这么少
   *   ⑤ 尺寸超过 600×640 —— 播放器那层自然被挡住
   * 另外：行内元素（`<a class="ad-report">` 这种）不能当遮罩宿主，见 blockTargetFor。
   */
  /** 量得出尺寸吗（0×0 的中间层多半是行内盒或 display:contents 的包装层，不该当宿主，也不该终止向上收） */
  function hasMeasurableBox(el) {
    var r = el.getBoundingClientRect ? el.getBoundingClientRect() : null;
    return !!(r && r.width && r.height);
  }

  function findAdCardFrame(slot) {
    var frame = slot;
    var cur = slot.parentElement;
    // 最多 5 层：广告位的嵌套链实测可以到 .ad-report-link > .item > .van-slide-item-box > .slide-ad > #slide_ad
    // 这么深，层数切太浅会让同一条链上的不同节点各自收到不同的一层，结果套出好几块遮罩
    for (var i = 0; cur && cur !== document.body && cur !== document.documentElement && i < 5; i++) {
      // 行内盒 / 量不到尺寸的包装层既不能当遮罩宿主，也不该让收敛就此停住 → 跳过它继续往上
      if (isInlineBox(cur) || !hasMeasurableBox(cur)) { cur = cur.parentElement; continue; }
      if (!isAdFrameCandidate(cur, slot)) break;
      frame = cur;
      cur = cur.parentElement;
    }
    return frame;
  }

  /**
   * 页面上的"面板/列表"：广告卡再往外收就一定会把无关内容卷进来
   * （实测反馈：播放器右边那块广告一往上收就把弹幕列表算进去了）。
   * 注意只认"面板容器"的类名，不认单条弹幕（`danmaku-item` 这类）——
   * 弹幕列表里的推广条本身就是一条弹幕，它得能当广告卡。
   */
  var AD_FRAME_PANEL_RE = /danmubox|danmaku-(list|box|container|wrap|panel)|comment|reply|recommend|player|right-container|video-info|toolbar|activity-plat|feed-list|video-list/i;

  function isAdFramePanel(el) {
    // 自身就是广告位（例如弹幕列表里那条推广）→ 不算面板
    if (el.matches && el.matches(AD_SLOT_SELECTOR)) return false;
    var cls = typeof el.className === 'string' ? el.className : '';
    var id = el.id || '';
    return AD_FRAME_PANEL_RE.test(cls) || AD_FRAME_PANEL_RE.test(id);
  }

  /** 像不像一张真卡片：有标题或有封面。只有"顺带匹配上"的空壳子元素才两条都不占 */
  function looksLikeRealCard(el) {
    if (findTitleEl(el)) return true;
    return hasCoverInside(el);
  }

  function isAdFrameCandidate(box, slot) {
    if (!box.querySelectorAll) return false;
    // ⓪ 页面功能区域（弹幕列表 / 播放器 / .video-pod-above-modules*）永远不能当广告外壳。
    //    实测：右栏 .video-pod-above-modules__inner 里同时装着弹幕列表和广告，
    //    少了这一条，一旦同层没有第二块广告位（例如广告没加载），收敛就会越过 __inner
    //    落到 .video-pod-above-modules 上，把弹幕列表一起隐掉（1.5.7 后的回归点）。
    if (box.matches && box.matches(PROTECTED_REGION_SELECTOR)) return false;
    if (box.querySelector(PROTECTED_REGION_SELECTOR)) return false;
    // ⓪-2 顶栏 / 导航同样绝不能被当成广告外壳收走：实测顶栏里也会出现推广位，
    //      一旦被收，首页/番剧/直播这些入口就跟着被遮住（反馈过的 bug）。
    if (box.matches && box.matches(NAV_EXCLUDE)) return false;
    if (box.querySelector && box.querySelector(NAV_EXCLUDE)) return false;
    if (isPlayerBannerHost(box) || (box.matches && box.matches(PLAYER_BANNER_INNER_SELECTOR))) return false;
    if (box.querySelector(PLAYER_BANNER_INNER_SELECTOR)) return false;   // 里面装着播放器横幅 → 别越过去
    if (isAdFramePanel(box)) return false;                             // ①
    if (box.children.length > AD_FRAME_MAX_CHILDREN) return false;      // ④

    // ② 别的广告位：只看"既不是当前广告位的祖先、也不是它的后代"的那种。
    //    祖先（比如 .video-card-ad-small 之于里面的 .ad-report）和后代都属于同一块广告，
    //    真正的信号是"同一层里还有另一块广告位"—— 实测右栏就是这样：
    //    .video-pod-above-modules__inner 里既有弹幕列表，又有空的 #slide_ad 和真广告卡。
    var ads = box.querySelectorAll(AD_SLOT_SELECTOR);
    for (var k = 0; k < ads.length; k++) {
      var other = ads[k];
      if (slot.contains(other) || other.contains(slot)) continue;
      return false;
    }

    var cards = box.querySelectorAll(CARD_SELECTOR);                   // ③
    for (var i = 0; i < cards.length; i++) {
      if (slot.contains(cards[i])) continue;        // 广告位自己（含它的后代）
      if (!looksLikeRealCard(cards[i])) continue;   // 只匹配到类名的空壳子元素，不算
      return false;
    }
    return isCardSizedBox(box, AD_FRAME_MAX_W, AD_FRAME_MAX_H);   // ⑤
  }

  /**
   * 遮罩宿主必须是块级元素。
   *
   * 实测反馈：「上面会有一些像素露在外面」——广告位常常是行内元素
   * （`<a class="ad-report">`、`<span class="ad-floor">` 这类），
   * 行内盒上放绝对定位的遮罩会错位，而且 `overflow:hidden` 对行内盒不生效，
   * 于是遮罩变成一条细线、底下的图片和文字照样露出来。
   * 所以先往上找到第一个块级祖先再动手；找不到（或找到的是面板）就交给上层判断。
   */
  function isInlineBox(el) {
    if (!el || !el.getComputedStyle) return false;
    var d = '';
    try { d = (el.ownerDocument.defaultView || window).getComputedStyle(el).display || ''; } catch (e) { return false; }
    if (d.indexOf('inline') !== 0) return false;
    return d !== 'inline-block' && d !== 'inline-flex' && d !== 'inline-grid';
  }

  function blockTargetFor(el) {
    var cur = el;
    for (var i = 0; i < 3 && cur && cur !== document.body; i++) {
      if (!isInlineBox(cur)) return cur;
      cur = cur.parentElement;
    }
    return el;
  }

  /**
   * 播放器里的活动横幅（实测结构，来自使用者贴的 Copy outerHTML）：
   *   .inside-wrp > .left  > .l-inside > .hinter-msg
   *                                              ↑ 文案「开学季，把兴趣玩出名堂！」
   *                > .right > .inside-bg.clickable > .b-img > img
   *                                              ↑ src 形如
   *                              //i2.hdslb.com/bfs/activity-plat/static/…/xxx.jpg@640w_200h_!web-video-activity-cover.avif
   *
   * 为什么不把 .inside-wrp 直接写进 CARD_SELECTOR：这个类名太通用（B 站多处活动位都在用），
   * 写死会让别的页面上的同名容器也被当成卡片。所以判据带上结构，而且扫描时是
   * 「先扫全部 .inside-wrp，再用结构判据筛」（不用 :has()，也没绑定 .right 这一层 ——
   * 实测里 onreadystatechange 式的中间层很容易变，绑定死了就会漏），
   * 整块一起处理 —— 只藏右边图片的话，左边那行文案会留在页面上（等于没屏蔽干净）。
   */
  var PLAYER_BANNER_INNER_SELECTOR = '.inside-wrp > .right > .inside-bg';

  /** 从横幅的图片块回到整块横幅容器（.inside-wrp），并确认它确实是这块横幅 */
  function playerBannerHostOf(el) {
    if (!el || !el.closest) return null;
    var host = el.closest('.inside-wrp');
    if (!host) return null;
    if (!isPlayerBannerHost(host)) return null;   // 结构不对 → 不是这块横幅
    return host;
  }

  /**
   * 这块 .inside-wrp 是不是播放器里的活动横幅：
   * 正常判据是「有文案行 .hinter-msg + 有图片块 .inside-bg」；
   * 兜底判据是「里面有走 /bfs/activity-plat/ 的活动图」——
   * B 站这类活动位的图片都来自活动平台，文案行的类名偶尔会变。
   */
  function isPlayerBannerHost(el) {
    if (!el || !el.matches || !el.matches('.inside-wrp')) return false;
    if (el.querySelector('.inside-bg') && el.querySelector('.hinter-msg')) return true;
    return !!el.querySelector('img[src*="activity-plat"]');
  }

  /**
   * 一个广告位应该处理哪一块：
   *   - 播放器活动横幅的图片块 → 整块横幅（.inside-wrp）
   *   - 其它广告位 → 先找块级宿主（行内元素不能放遮罩），再往上收成"整卡外壳"
   */
  function adSlotTarget(el) {
    if (!el || !el.matches) return null;
    if (isChromeRegion(el)) return null;   // 顶栏 / 导航里的推广位同样不碰（宁可不屏蔽）
    var banner = playerBannerHostOf(el);
    if (banner) return banner;
    if (el.matches(PLAYER_BANNER_INNER_SELECTOR)) return null;
    if (el.matches('.inside-wrp')) return isPlayerBannerHost(el) ? el : null;
    if (!el.matches(AD_SLOT_SELECTOR)) return null;
    var host = blockTargetFor(el);
    if (!host || isInlineBox(host)) return null;   // 找不到块级宿主 → 宁可不遮，也别遮成一条线
    var frame = findAdCardFrame(host);
    // 宿主必须是"能量出尺寸的块"：实测条幅广告里那个 <a class="ad-report-inner"> 是 888×0，
    // 把遮罩放在它上面就会变成一条细线（反馈里"遮罩不到位"的来源之一）。
    // 这种时候退回广告位本身；广告位自己也量不出尺寸就干脆不遮。
    if (!hasMeasurableBox(frame)) {
      if (hasMeasurableBox(el)) return el;
      if (hasMeasurableBox(host)) return host;
      return null;
    }
    // 绝对不许碰装着播放器的那一层：遮罩/隐藏它会让播放器塌掉（实测隐藏模式下视频从
    // 888×500 缩成 320×180），B 站还有"白屏检测"，塌了可能触发它自己刷新页面
    if (containsPlayer(frame)) return hasMeasurableBox(el) && !containsPlayer(el) ? el : null;
    return frame;
  }

  /**
   * 判定卡片属于哪个分区 / 类型。
   * 先看封面徽标（最可靠），认不出来再退回「链接 + class」判定；
   * 「其他推广」只在该卡片没有命中任何具体分区时才生效，
   * 这样关掉某个分区开关时不会又被兜底规则抓回来。
   */
  /**
   * 这个广告位里现在有没有真内容。
   * 实测右栏的 #slide_ad 经常只是一个注释占位（`<div id="slide_ad"><!----></div>`），
   * 这种空位不该被遮 —— 遮了就是凭空多出一个"已按分区设置屏蔽此推广"的提示框。
   */
  function hasVisibleAdContent(el) {
    if (!el) return false;
    if (el.querySelector && el.querySelector('img[src], picture, iframe, canvas, video')) return true;
    return cleanText(el).length > 0;
  }

  /** 元素速写：TAG.class#id 实测尺寸 —— 诊断日志里用来描述结构 */
  function describeEl(el) {
    if (!el) return '(无)';
    var cls = typeof el.className === 'string' ? el.className.trim() : '';
    var r = el.getBoundingClientRect ? el.getBoundingClientRect() : { width: 0, height: 0 };
    return el.tagName + (cls ? '.' + cls.split(/\s+/).join('.') : '') + (el.id ? '#' + el.id : '') +
      ' ' + Math.round(r.width) + '×' + Math.round(r.height);
  }

  /** 这个元素里装着播放器吗（<video> 或播放器容器）—— 装着就绝不能遮/隐藏 */
  function containsPlayer(el) {
    if (!el || !el.querySelector) return false;
    return !!(el.matches && (el.matches('#bilibili-player, .bpx-player-container, .bilibili-player')) ||
      el.querySelector('video, #bilibili-player, .bpx-player-container, .bilibili-player'));
  }

  /** 从元素往上最多 4 层的结构链（诊断用） */
  function describeChain(el, depth) {
    var out = [];
    var cur = el;
    for (var i = 0; i < (depth || 4) && cur && cur !== document.body; i++) {
      out.push(describeEl(cur));
      cur = cur.parentElement;
    }
    return out.join(' < ');
  }

  /** 卡片里第一个链接的 host + path（诊断用，判断"这张卡到底链到哪"） */
  function firstHrefOf(card) {
    var a = card.querySelector('a[href]');
    if (!a) return '(无链接)';
    return (a.getAttribute('href') || '').replace(/^\/\//, 'https://').split('?')[0];
  }

  /**
   * 这一类认得的所有徽标写法（badge + badges），同义写法都算
   */

  function typeBadges(t) {
    var out = [];
    if (t.badge) out.push(t.badge);
    if (t.badges && t.badges.length) {
      for (var i = 0; i < t.badges.length; i++) {
        if (out.indexOf(t.badges[i]) === -1) out.push(t.badges[i]);
      }
    }
    return out;
  }

  function detectType(card) {
    // 广告位容器的身份由类名直接确定，不再往下猜：
    // 广告里常混着 /topic-detail、活动页之类的链接，按链接判定会被排在
    // 「广告」前面的类型抢走（TYPES 里 activity 在 ad 之前），点「广告」开关就没反应。
    if (isAdSlot(card)) return 'ad';

    var badge = getBadgeText(card);
    if (badge) {
      for (var b = 0; b < TYPES.length; b++) {
        var bt = TYPES[b];
        var words = typeBadges(bt);
        for (var w = 0; w < words.length; w++) {
          if (badge.indexOf(words[w]) !== -1) return bt.key;
        }
      }
    }
    var hits = matchSpecificTypes(card);
    if (hits.length) return hits[0];
    var other = getType('other');
    if (other && other.href && anchorHrefsMatch(card, other.href)) return 'other';
    return 'video';
  }

  function isExcludedAnchor(a) {
    return !!(a.closest && a.closest(NAV_EXCLUDE));
  }

  /* ------------------------------------------------------------------
   * 首页顶部的大轮播横幅（独立开关）
   * ------------------------------------------------------------------ */

  /**
   * 找到首页顶部的大轮播横幅。
   * 实测（Edge 152 / 2025-09）：轮播由 11 个 .carousel-area 幻灯片组成，
   * 外层包在 .vui_carousel 里，位于页顶（header 265px 之下）。
   * 判定条件：位于页面上部 + 尺寸够大 + 内部有 carousel 结构。
   */
  function findHomeBanner() {
    if (location.pathname !== '/' && location.pathname !== '/index.html') return null;

    var areas = document.querySelectorAll('.carousel-area');
    for (var i = 0; i < areas.length; i++) {
      var root = areas[i].closest('.vui_carousel') || areas[i].parentElement;
      if (!root) continue;
      var r = root.getBoundingClientRect();
      if (!r.width || !r.height) continue;   // 拿不到尺寸（隐藏幻灯片）就跳过
      if (r.width < 300 || r.height < 150) continue;
      if (r.top > 600) continue;             // 必须在页面顶部
      return outermostBannerBox(root);
    }
    return null;
  }

  /** 外层的轮播容器（实测层级：.carousel > .carousel-container > .vui_carousel） */
  function isBannerWrapper(el) {
    var cls = typeof el.className === 'string' ? el.className : '';
    return /(^|\s)(carousel|carousel-container|carousel-wrap|banner|banner-container)(\s|$)/.test(cls);
  }

  /**
   * 往上取到"只装着这个轮播"的最外层容器。
   *
   * 为什么必须这样：实测 B 站这里三层都是 height:100%（.carousel / .carousel-container /
   * .vui_carousel 全是），只把里层 .vui_carousel 隐藏掉的话，外层会留下一个空白框
   * —— 就是「不能被完全隐藏」。往上走到 .carousel 这一层，整块才会真的收起来。
   */
  function outermostBannerBox(root) {
    var el = root;
    for (var i = 0; i < 4; i++) {
      var parent = el.parentElement;
      if (!parent || !isBannerWrapper(parent)) break;
      el = parent;
    }
    return el;
  }

  /**
   * 首页顶部横幅广告（.bili-header__banner）不在本扩展的屏蔽范围内。
   * 1.3.2 曾经把它并进「屏蔽首页顶部轮播横幅」开关，1.3.3 按反馈移除了：
   * 那个开关只管首页顶部的大轮播，不再碰头部横幅图。
   */

  /** 轮播所在的"版块"包装层（实测：.recommended-swipe-body-normal > .recommended-swipe-body > .recommended-swipe-core > .recommended-swipe） */
  var SWIPE_WRAPPER_RE = /(^|\s)(recommended-swipe|recommended-swipe-core|recommended-swipe-body|recommended-swipe-body-normal|recommended-swipe-body-loading|recommended-swipe-body-error|recommended-swipe-body-nothing)(\s|$)/;

  function isSwipeWrapper(el) {
    var cls = typeof el.className === 'string' ? el.className : '';
    return SWIPE_WRAPPER_RE.test(cls);
  }

  /** 这一层除了轮播本身，还有没有别的东西（有就不越过，避免误藏真实内容） */
  function slotHasForeignContent(slot, el) {
    var imgs = slot.querySelectorAll('img');
    for (var i = 0; i < imgs.length; i++) {
      if (imgs[i].naturalWidth > 0 && !el.contains(imgs[i])) return true;
    }
    var all = (slot.textContent || '').replace(/\s+/g, '');
    var own = (el.textContent || '').replace(/\s+/g, '');
    var rest = own ? all.split(own).join('') : all;
    return rest.length > 8;
  }

  /**
   * 完全隐藏时，光把 .carousel 藏掉是不够的（实测 2026-09）：
   *   - .recommended-swipe-body / .recommended-swipe-body-normal 是 position:absolute;inset:0
   *     且 background-color:var(--graph_bg_regular) 的一层灰底，轮播一藏它就露出来；
   *   - .recommended-swipe 是网格项（grid-column:1/3；grid-row:1/3），
   *     高度由里层的 .shim-card（height:0 + padding-top:56.25%）撑着 ——
   *     所以只藏轮播的话，页面上方那个 2×2 的格子还占着，后面的视频顶不上来
   *     （就是反馈里的「还有占位符、后面视频无法补位」）。
   * 因此这里一路往上收到 .recommended-swipe，整块拿掉，格子才会被后面的卡片补上。
   */
  function bannerSlotBox(el) {
    var box = el;
    for (var i = 0; i < 5; i++) {
      var cls = typeof box.className === 'string' ? box.className : '';
      if (/(^|\s)recommended-swipe(\s|$)/.test(cls)) break;   // 已经到网格项了，到此为止
      var parent = box.parentElement;
      if (!parent || !isSwipeWrapper(parent)) break;
      if (slotHasForeignContent(parent, box)) break;
      box = parent;
    }
    return box;
  }

  /**
   * 首页顶部的大轮播横幅：开关一开就整块完全隐藏，**不跟随屏蔽方式**。
   * 原因：横幅不是视频卡片，盖一块"为什么被屏蔽"的说明没有意义 ——
   * 打开的意图就是"这块别出现"，所以无论当前是整体遮蔽还是完全隐藏，都直接收起。
   * 收起时会连外层的灰底空壳和它占着的网格项一起处理，
   * 页面不留空白、后面的内容能补上来。
   */
  function applyBannerTarget(el) {
    el.classList.add('bf-banner-blocked');
    var slot = bannerSlotBox(el);
    el.classList.add('bf-hide');
    if (slot && slot !== el) slot.classList.add('bf-banner-blocked', 'bf-hide');
    log('已隐藏首页顶部轮播横幅');
  }

  function applyBannerBlock() {
    // 先撤掉上一轮的标记（含"完全隐藏"时一起收起来的那个版块容器）
    var marked = document.querySelectorAll('.bf-banner-blocked');
    for (var i = 0; i < marked.length; i++) {
      var old = marked[i];
      old.classList.remove('bf-banner-blocked', 'bf-blocked', 'bf-hide', 'bf-hide-slot');
      var oldMask = old.querySelector(':scope > .bf-mask');
      if (oldMask) oldMask.remove();
    }

    if (!settings.enabled || !settings.blockBanner) return;

    var banner = findHomeBanner();
    if (banner) applyBannerTarget(banner);
  }

  /* ------------------------------------------------------------------
   * 完全隐藏模式下：收敛被"顶上来"的空骨架占位项
   * ------------------------------------------------------------------ */

  /** 加载哨兵 / 锚点类元素绝不能动，否则会影响 B 站继续加载内容 */
  function isLoadSentinel(el) {
    var cls = typeof el.className === 'string' ? el.className : '';
    return /load-more|loadmore|anchor|sentinel|observer|spinner|loading/i.test(cls);
  }

  /**
   * 是不是"空占位项"。
   * 判定要点（每一条都是真实页面上踩出来的）：
   *   - 有实际文字（> 4 字）→ 真实内容
   *   - 有已加载完成的图片 / 任何视频画布 → 真实内容
   *     （只看 naturalWidth：图片没加载完时不算内容，这正是 B 站占位骨架的样子）
   *   - 必须"看起来就是占位"：完全空壳，或含骨架屏 / 垫片（shim）元素
   */
  function isEmptyPlaceholder(el) {
    if (!el || el.nodeType !== 1) return false;
    if (el.classList.contains('bf-blocked')) return false;

    var text = (el.textContent || '').replace(/\s+/g, '').trim();
    if (text.length > 4) return false;

    var media = el.querySelectorAll('img, video, canvas, iframe');
    for (var i = 0; i < media.length; i++) {
      if (media[i].tagName === 'IMG') {
        if (media[i].naturalWidth > 0) return false;   // 图片已加载 → 真实内容
      } else {
        return false;                                  // 视频 / 画布 / 内嵌页 → 真实内容
      }
    }

    if (!text) return true;                            // 一个字都没有 → 空占位
    // 有极短文字（例如"加载中"）→ 必须带骨架屏 / 垫片标记才认定是占位
    return !!el.querySelector('[class*="skeleton"], [class*="shim"]');
  }

  /** 只在实际需要时改类名，避免无谓的样式重算与抖动 */
  function toggleClass(el, cls, on) {
    if (on) {
      if (!el.classList.contains(cls)) el.classList.add(cls);
    } else if (el.classList.contains(cls)) {
      el.classList.remove(cls);
    }
  }

  /** 从被隐藏的卡片往上找真正的网格容器（可能隔了几层，例如 .floor-single-card） */
  function findGridAncestor(el) {
    var cur = el ? el.parentElement : null;
    for (var i = 0; cur && i < 6; cur = cur.parentElement, i++) {
      var display = '';
      try { display = getComputedStyle(cur).display; } catch (e) { display = ''; }
      if (display === 'grid' || display === 'inline-grid') return cur;
    }
    return null;
  }

  /** 收集网格里的空占位项：先看直接子元素，再往下看一层（覆盖 .floor-* 这类包裹） */
  function collectPlaceholders(grid, out) {
    var level1 = grid.children;
    for (var i = 0; i < level1.length; i++) {
      var el = level1[i];
      if (el.classList.contains('bf-blocked')) continue;
      if (isEmptyPlaceholder(el)) { out.push(el); continue; }
      var level2 = el.children;
      for (var k = 0; k < level2.length; k++) {
        var inner = level2[k];
        if (inner.classList.contains('bf-blocked')) continue;
        if (isEmptyPlaceholder(inner)) out.push(inner);
      }
    }
    return out;
  }

  /**
   * 「完全隐藏 · 移除位置」专用：
   * 卡片被整个移除后，网格会把排在末尾的空占位项拉到前面填空，
   * 看起来就是内容中间多出一块块灰色空盒。这里把它们收敛掉：
   *   - 普通空占位项 → display:none
   *   - 加载哨兵（.load-more-anchor 等）→ 只 visibility:hidden，
   *     保留布局盒与位置，避免影响 B 站继续加载内容
   *   - 又高又空的"占位容器"（> 400px）→ 同样只隐身，
   *     避免隐藏后页面高度骤变导致滚动跳动
   * 占位项被真实内容填充后会立刻自动恢复；每次只做必要的类名变更。
   */
  function applyPlaceholderCollapse() {
    var wantedCollapsed = [];
    var wantedMuted = [];

    if (settings.enabled && settings.mode === 'hide' && settings.hideKeepSlot === false) {
      var hiddenCards = document.querySelectorAll('.bf-blocked.bf-hide');
      var grids = [];
      for (var j = 0; j < hiddenCards.length; j++) {
        var grid = findGridAncestor(hiddenCards[j]);
        if (grid && grids.indexOf(grid) === -1) grids.push(grid);
      }
      for (var g = 0; g < grids.length; g++) {
        var items = collectPlaceholders(grids[g], []);
        for (var c = 0; c < items.length; c++) {
          var el = items[c];
          var h = 0;
          try { h = el.getBoundingClientRect().height; } catch (e) { h = 0; }
          if (isLoadSentinel(el) || h > 400) wantedMuted.push(el);
          else wantedCollapsed.push(el);
        }
      }
    }

    // 只做必要变更：先撤掉不再需要的，再补上需要的
    var marked = document.querySelectorAll('.bf-ph-collapsed, .bf-ph-muted');
    for (var i = 0; i < marked.length; i++) {
      toggleClass(marked[i], 'bf-ph-collapsed', wantedCollapsed.indexOf(marked[i]) !== -1);
      toggleClass(marked[i], 'bf-ph-muted', wantedMuted.indexOf(marked[i]) !== -1);
    }
    for (var a = 0; a < wantedCollapsed.length; a++) toggleClass(wantedCollapsed[a], 'bf-ph-collapsed', true);
    for (var b = 0; b < wantedMuted.length; b++) toggleClass(wantedMuted[b], 'bf-ph-muted', true);

    if (wantedCollapsed.length || wantedMuted.length) {
      log('收敛空占位项：隐藏 ' + wantedCollapsed.length + ' 个，隐身保留 ' + wantedMuted.length + ' 个');
    }
  }
  /* ------------------------------------------------------------------
   * 屏蔽 / 恢复
   * ------------------------------------------------------------------ */

  function buildMaskText(action) {
    if (action.kind === 'keyword') {
      return {
        main: settings.maskText || DEFAULTS.maskText,
        sub: action.kw ? '屏蔽词：' + action.kw : ''
      };
    }
    var tpl = settings.typeMaskText || DEFAULTS.typeMaskText;
    return {
      main: tpl.replace('{type}', typeLabel(action.type)),
      sub: ''
    };
  }

  function ensureMask(card, action) {
    var mask = card.querySelector(':scope > .bf-mask');
    var text = buildMaskText(action);

    if (!mask) {
      mask = document.createElement('div');
      mask.className = 'bf-mask';
      mask.innerHTML =
        '<span class="bf-mask__icon">' + MASK_ICON_SVG + '</span>' +
        '<span class="bf-mask__text"></span>' +
        '<span class="bf-mask__sub"></span>' +
        '<span class="bf-mask__hint"></span>';
      card.appendChild(mask);
    }
    mask.querySelector('.bf-mask__text').textContent = text.main;
    var sub = mask.querySelector('.bf-mask__sub');
    sub.textContent = text.sub;
    sub.style.display = text.sub ? 'block' : 'none';

    // 现在只有视频卡片会产生遮罩，而卡片都绑定了"悬停查看"，这行提示说的是实话
    var hint = mask.querySelector('.bf-mask__hint');
    if (settings.revealOnHover) {
      hint.textContent = '鼠标悬停可查看';
      hint.style.display = 'block';
    } else {
      hint.textContent = '';
      hint.style.display = 'none';
    }
  }

  /** 悬停自动展示 + 遮蔽状态下拦截误点击 */
  function bindHoverReveal(card) {
    if (hoverBound.has(card)) return;
    hoverBound.add(card);

    card.addEventListener('mouseenter', function () {
      if (settings.revealOnHover && card.classList.contains('bf-blocked')) {
        card.classList.add('bf-revealed');
      }
    });
    card.addEventListener('mouseleave', function () {
      if (card.classList.contains('bf-revealed')) card.classList.remove('bf-revealed');
    });

    // 仍处于遮蔽状态时点击不该跳转（悬停展示后可正常点开）
    card.addEventListener('click', function (e) {
      if (card.classList.contains('bf-blocked') && !card.classList.contains('bf-revealed')) {
        e.preventDefault();
        e.stopPropagation();
      }
    }, true);
  }

  function applyBlock(card, action) {
    // 兜底：顶栏 / 导航 / 登录面板绝不允许被打上屏蔽类（上面 processCard 已经拦了一道，
    // 这里再拦一道，防止将来新增路径绕过）
    if (isChromeRegion(card)) return;
    // 兜底：装着播放器的容器绝不能被打上屏蔽类（遮罩/隐藏它会让播放器塌掉，
    // 而 B 站有白屏检测，塌了可能触发它自己刷新页面 —— 反馈里"播放时页面重新加载"）
    if (containsPlayer(card)) return;

    var wasBlocked = card.dataset.bfState === 'blocked';
    var already = wasBlocked && card.dataset.bfKey === action.key;

    // 安全阀：尺寸不像一张卡片时，宁可不屏蔽，也绝不制造页面空白。
    // 注意这里必须看"是否已被屏蔽过"而不是"命中原因是否相同"：
    // 完全隐藏模式下卡片是 display:none（尺寸为 0），
    // 若因为命中词变化就拒绝处理，切回遮蔽模式时这些卡片会一直隐藏不恢复。
    if (!wasBlocked && !isPlausibleCardSize(card)) {
      log('跳过尺寸异常的容器（避免页面空白）：', card.className, action.key);
      return;
    }

    if (already) {
      // 命中原因没变，但屏蔽方式 / 文案 / 悬停展示等设置可能变了，这里同步刷新
      card.dataset.bfCard = '1';
      applyModeClasses(card);
      ensureMask(card, action);
      updateCompact(card);
      return;
    }

    card.dataset.bfCard = '1';
    card.dataset.bfState = 'blocked';
    card.dataset.bfKey = action.key;
    card.dataset.bfKind = action.kind;

    if (action.kind === 'type') card.dataset.bfType = action.type;
    else delete card.dataset.bfType;

    card.classList.remove('bf-revealed');
    card.classList.add('bf-blocked');
    applyModeClasses(card);

    ensureMask(card, action);
    bindHoverReveal(card);
    updateCompact(card);

    sessionBlocked += 1;
    bumpStat(1);
    log('已屏蔽：', action.key, getTitle(card));
    if (action.type === 'ad' || isAdSlot(card)) {
      // 调试日志里带上"遮的是哪一层"和它的实测尺寸，方便日后核对广告位结构变化
      log('广告位遮罩宿主：', describeChain(card, 2));
    }
  }

  /**
   * 找出"承载这张卡片外观的最外层容器"。
   *
   * 真实 B 站里，分区推广卡片外面还套着一层带 边框 + 背景 + 阴影 的盒子，例如：
   *   .floor-card { border:1px solid #e3e5e7; background:var(--bg1);
   *                 box-shadow:0 0 40px rgba(0,0,0,.03); border-radius:6px; padding:12px }
   * 而卡片本体（.floor-card-inner）在里面。
   * 如果只隐藏本体，外层那个"空边框 + 阴影"的盒子会留在页面上，
   * 看起来就是一块带淡边线的白色空框（用户反馈的"阴影的占位符还在"）。
   *
   * 规则：从卡片向上走，只要这一层仍然"只装着当前这一张卡片"就继续向上，
   * 直到遇到网格项（再往上就是列表容器）或遇到含其它卡片的容器为止。
   */
  function findCardFrame(card) {
    var frame = card;
    var cur = card.parentElement;
    for (var i = 0; cur && cur !== document.body && cur !== document.documentElement && i < 5; i++) {
      if (!containerFullyHidden(cur)) break;    // 这一层还有没被隐藏的卡片 → 不能越过
      frame = cur;
      var parent = cur.parentElement;
      if (!parent) break;
      var pd = '';
      try { pd = getComputedStyle(parent).display; } catch (e) { pd = ''; }
      if (pd === 'grid' || pd === 'inline-grid') break;   // 已经到网格项了
      cur = parent;
    }
    return frame;
  }

  /**
   * 这一层是不是"里面的卡片全部已经被我们隐藏了"。
   *
   * 用途：外层容器常常带自己的背景（例如 .recommended-swipe-body 铺满灰底、
   * .floor-card 带边框和阴影）。只要容器里还留着一张没被隐藏的卡片，我们就不能动它；
   * 但如果里面的卡片都被隐藏了，把这个空壳一起藏掉才不会留下灰底空框。
   * 注意：完全没有任何卡片的容器也算"可以越过"，但它不能同时含有真实文字内容。
   */
  function containerFullyHidden(el) {
    // 0) 容器里装着页面功能（弹幕列表 / 播放器 / 顶栏导航）→ 永远不算"空壳"。
    //    实测：播放页的 .video-pod-above-modules__inner 同时装着弹幕列表和贴片广告，
    //    少了这一条，隐藏广告时会顺着空壳往上把弹幕列表也隐掉。
    if (el.matches && el.matches(PROTECTED_REGION_SELECTOR)) return false;
    if (el.querySelector && el.querySelector(PROTECTED_REGION_SELECTOR)) return false;
    // 顶栏 / 导航同理：完全隐藏模式下收敛空壳时绝不能把顶栏一起隐掉
    if (el.matches && el.matches(NAV_EXCLUDE)) return false;
    if (el.querySelector && el.querySelector(NAV_EXCLUDE)) return false;

    // 1) 容器里所有卡片都必须已经被我们隐藏
    var cards = el.querySelectorAll(CARD_SELECTOR);
    for (var i = 0; i < cards.length; i++) {
      var c = cards[i];
      var parent = c.parentElement;
      if (parent && parent.closest(CARD_SELECTOR)) continue;   // 嵌套卡片只看最外层
      if (c.dataset.bfState !== 'blocked') return false;
    }
    // 2) 除了这些卡片，容器里不能还有其它真实内容（文字或已加载的图片）
    var kids = el.children;
    for (var k = 0; k < kids.length; k++) {
      var kid = kids[k];
      if (kid.dataset && kid.dataset.bfState === 'blocked') continue;
      if (kid.querySelector && kid.querySelector('[data-bf-state="blocked"]')) continue;
      if ((kid.textContent || '').replace(/\s+/g, '').trim().length > 4) return false;
      var imgs = kid.querySelectorAll ? kid.querySelectorAll('img') : [];
      for (var m = 0; m < imgs.length; m++) {
        if (imgs[m].naturalWidth > 0) return false;
      }
    }
    return true;
  }
  /**
   * 按当前屏蔽方式给卡片打类：
   *   整体遮蔽          → bf-blocked（内容隐藏 + 显示遮罩）
   *   完全隐藏·保留位置 → bf-hide-slot（只隐藏内容，位置留空，页面不重排）
   *   完全隐藏·移除位置 → bf-hide（display:none，后面的内容前移补位）
   */
  function applyModeClasses(card) {
    var hide = settings.mode === 'hide';
    var keepSlot = hide && settings.hideKeepSlot !== false;

    card.classList.toggle('bf-hide', hide && !keepSlot);
    card.classList.toggle('bf-hide-slot', keepSlot);
    card.classList.toggle('bf-hoverable', !hide && !!settings.revealOnHover);

    // 承载卡片外观的外层容器（带边框 / 背景 / 阴影的那种）必须一起处理，
    // 否则会出现"内容没了、边框和阴影的空盒子还在"的残留。
    // 每次重新计算：同一容器里的其它卡片后来也被隐藏时，容器本身也应该跟着藏起来。
    var next = findCardFrame(card);
    var prev = card.__bfFrame;
    if (prev && prev !== card && prev !== next) {
      prev.classList.remove('bf-hide', 'bf-hide-slot');
    }
    card.__bfFrame = next;
    if (next && next !== card) {
      next.classList.toggle('bf-hide', hide && !keepSlot);
      next.classList.toggle('bf-hide-slot', keepSlot);
    }
  }

  function clearBlock(card) {
    card.dataset.bfCard = '1';
    if (card.dataset.bfState !== 'blocked') return;

    card.classList.remove('bf-blocked', 'bf-hide', 'bf-hide-slot', 'bf-hoverable', 'bf-revealed', 'bf-compact');
    // 外层容器上的隐藏类也要撤掉
    var frame = card.__bfFrame;
    if (frame && frame !== card) frame.classList.remove('bf-hide', 'bf-hide-slot');
    card.__bfFrame = null;
    delete card.dataset.bfState;
    delete card.dataset.bfKey;
    delete card.dataset.bfKind;
    delete card.dataset.bfType;
    var mask = card.querySelector(':scope > .bf-mask');
    if (mask) mask.remove();
  }

  /** 卡片很矮时压缩提示内容（隐藏状态下无法测量，保持原状） */
  function updateCompact(card) {
    var h = card.getBoundingClientRect().height;
    if (!h) {
      card.classList.remove('bf-compact');
      return;
    }
    if (h < 120) card.classList.add('bf-compact');
    else card.classList.remove('bf-compact');
  }

  /**
   * 当前页面要不要屏蔽。
   *
   * - 登录页一律不屏蔽：B 站的登录在 passport.bilibili.com（也可能挂在路径带 login 的页面上），
   *   那块登录卡片里的链接会命中「其他推广」的域名规则，于是整块登录面板被当成推广屏蔽掉
   *   （有人反馈过这个 bug）。登录页本来也没有视频可筛，直接跳过。
   * - 站内搜索结果页：按开关，默认开。
   * - UP 个人主页：按开关，默认关（主页上大多是 TA 自己的作品，默认不动）。
   */
  function shouldBlockOnThisPage() {
    var host = (location.hostname || '').toLowerCase();
    var path = (location.pathname || '').toLowerCase();

    if (host === 'passport.bilibili.com' || host === 'passport.bilibili.cn') return false;
    if (/(^|\/)login(\/|$|\.)/.test(path) || path.indexOf('/login') !== -1) return false;

    if (host === 'search.bilibili.com') return settings.blockOnSearch !== false;
    if (host === 'space.bilibili.com') return settings.blockOnSpace === true;
    return true;
  }

  /** 祖先里有没有"真的被遮住了"的卡片（只处理过的标记不算，见 scanAdSlots 的说明） */
  function insideBlockedCard(el) {
    var p = el.parentElement;
    return !!(p && p.closest('[data-bf-state="blocked"]'));
  }

  function processCard(card, opts) {
    // opts.ad：广告位专用，绕过 isNestedCard（它看的是"祖先处理过没有"，
    // 而没被屏蔽的卡片也会带上那个标记，会把广告位永久卡住）
    if (!(opts && opts.ad) && isNestedCard(card)) return;

    // 顶栏 / 导航 / 登录面板：任何路径都不许屏蔽。
    // 反馈过：播放页开了「广告」之后顶栏的入口被整块遮住 —— 所以这一关放在最前面，
    // 关键词、分区开关、广告位、徽标发现、外层空壳收敛全都必须过它。
    if (isChromeRegion(card)) {
      if (card.dataset.bfState === 'blocked') {
        log('顶栏/导航区域，撤销屏蔽：', describeEl(card));
        clearBlock(card);
      }
      return;
    }

    if (!settings.enabled) {
      clearBlock(card);
      return;
    }

    // 页面级开关：搜索页 / UP 主页 / 登录页（登录页永远不屏蔽）
    if (!shouldBlockOnThisPage()) {
      clearBlock(card);
      return;
    }

    // 白名单优先：名单里的 UP 直接放行，关键词和分区开关都不再作用于它
    if (isWhitelisted(card)) {
      if (card.dataset.bfState === 'blocked') log('白名单放行：', getUpName(card) || getUpUid(card));
      clearBlock(card);
      return;
    }

    var type = detectType(card);

    // 诊断：每张卡片第一次被看到时打一行，说明「角标文案 → 判定成哪一类 → 链接到哪」；
    // 广告位则带上"当前「广告」开关是开还是关"和往上三层的结构链。
    // 反馈里"某个开关点了没反应"基本都是这几者之一变了，有这一行就不用靠猜
    //（需要先在设置页打开「输出调试日志到控制台」）。只打一次，避免每次扫描刷屏。
    if (settings.debug && card.dataset.bfSeen !== '1') {
      card.dataset.bfSeen = '1';
      var seenBadge = getBadgeText(card);
      if (seenBadge) {
        log('卡片角标诊断：角标「' + seenBadge + '」→ 判定为 ' + type + '（' + typeLabel(type) + '）' +
          '｜链接 ' + firstHrefOf(card));
      } else if (type === 'ad') {
        log('广告位诊断：判定为广告，「广告」开关当前是' +
          (settings.blockTypes && settings.blockTypes.ad ? '开' : '关') +
          '｜' + describeChain(card, 3));
      }
    }

    if (settings.blockTypes && settings.blockTypes[type]) {
      // 空广告位不遮：实测右栏的 #slide_ad 常常只有一个注释占位（<!---->），
      // 遮了就是凭空多出一个提示框
      if (type === 'ad' && !hasVisibleAdContent(card)) {
        log('广告位当前是空的，跳过：', describeEl(card));
        clearBlock(card);
        return;
      }
      applyBlock(card, { key: 'type:' + type, kind: 'type', type: type });
      return;
    }

    var hit = matcher ? matcher(getTitle(card)) : null;
    if (!hit && settings.matchUpName) hit = matcher ? matcher(getUpName(card)) : null;

    if (hit) applyBlock(card, { key: 'kw:' + hit, kind: 'keyword', kw: hit });
    else clearBlock(card);
  }

  /* ------------------------------------------------------------------
   * 扫描：已知卡片 / 通用分区卡片 / 整行板块
   * ------------------------------------------------------------------ */

  function fullScan(force) {
    var all = document.querySelectorAll(CARD_SELECTOR);
    for (var i = 0; i < all.length; i++) {
      var card = all[i];
      if (isNestedCard(card)) continue;
      if (!force && card.dataset.bfCard === '1') continue;
      processCard(card);
    }
  }

  /**
   * 通用分区卡片扫描：不依赖 class，
   * 只要卡片里存在指向该分区的链接，就向上推断出卡片容器并处理。
   *
   * 注意候选筛选用的是**全部**已知分区链接特征，而不是只用在设置里打开的那几个开关：
   * 屏蔽词要能作用到页面上任意一张推广卡片上（例如只开了「直播」开关时，
   * 番剧推广卡片同样应该被屏蔽词命中）。是否真的屏蔽仍然由 processCard 决定。
   * 一个开关都没开、也没有屏蔽词时直接退出，不做无谓的全页扫描。
   */
  function scanTypedCards() {
    if (!settings.enabled) return;
    var hasType = false;
    for (var t = 0; t < TYPES.length; t++) {
      if (settings.blockTypes[TYPES[t].key]) { hasType = true; break; }
    }
    var hasKeywords = !!(settings.keywords && settings.keywords.length);
    if (!hasType && !hasKeywords) return;

    var anchors = document.querySelectorAll('a[href]');
    var handled = 0;
    for (var i = 0; i < anchors.length && handled < 300; i++) {
      var a = anchors[i];
      if (isExcludedAnchor(a)) continue;
      // 广告位里的链接交给 scanAdSlots 处理；这里若还按链接往上猜，
      // 会因为"列表容器里恰好有标题和封面"而一路猜到列表容器上，把整列推荐一起遮掉
      if (a.closest && a.closest(AD_SLOT_SELECTOR)) continue;
      if (a.closest && a.closest(BANNER_EXCLUDE)) continue;   // 横幅交给板块级开关
      var href = a.getAttribute('href') || '';
      var hit = null;
      for (var j = 0; j < TYPES.length; j++) {
        if (TYPES[j].href && TYPES[j].href.test(href)) { hit = TYPES[j]; break; }
      }
      if (!hit) continue;

      var card = resolveCardTarget(a, hit.href);
      if (!card) continue;   // 无法确认是一张卡片 → 宁可不屏蔽
      // 记住这类卡片：它们不在 CARD_SELECTOR 里，
      // 关闭分区开关时需要靠这份记录把它们恢复原状
      if (!card.matches || !card.matches(CARD_SELECTOR)) trackedCards.add(card);
      if (card.dataset.bfState === 'blocked') continue;   // 已屏蔽，跳过
      processCard(card);
      handled++;
    }
  }

  /**
   * 徽标驱动的卡片发现（第三条发现路径）。
   *
   * 为什么要有这一条：scanTypedCards 只认「卡片里的链接」，fullScan 只认已知类名。
   * 可首页「赛事」这类模块的推广卡片是直接跳视频页 / 活动页的，链接里既没有
   * /match/ 也没有 /esports/，类名也可能不在名单里 —— 整类卡片就永远扫不到，
   * 开关点了没反应（反馈过两次，而且每次都只有赛事这一类）。
   * 而分类阶段最可靠的判据恰好是封面徽标，所以发现阶段也用一次徽标：
   * 从徽标往上找到"同时含封面与标题"的那一层，全程复用安全阀，推不出来就跳过。
   *
   * 这一条来自另一位贡献者发的 1.5.6 构建（他当时的写法是 scanBadgeCards），
   * 与本文件里把 .floor-card-inner 写进卡片名单的做法互补：那条管已知楼层结构，
   * 这条管"徽标认得出来、但结构或链接都不认识"的卡片。
   */
  function resolveBadgeCard(box, hrefRe) {
    var known = box.closest(CARD_SELECTOR);
    if (known && !isAdSlot(known)) return isSafeCardTarget(known, hrefRe) ? known : null;

    var scope = box;
    for (var i = 0; i < 6 && scope && scope !== document.body; i++) {
      if (scope !== box && hasTitleInside(scope) && hasCoverInside(scope) &&
          isSafeCardTarget(scope, hrefRe)) {
        return scope;
      }
      scope = scope.parentElement;
    }
    return null;
  }

  function scanBadgeCards() {
    if (!settings.enabled) return;
    var boxes = document.querySelectorAll(BADGE_SELECTOR);
    var handled = 0;
    for (var i = 0; i < boxes.length && handled < 200; i++) {
      var box = boxes[i];
      if (box.closest && box.closest('.bf-mask')) continue;
      if (isExcludedAnchor(box)) continue;                        // 顶栏 / 登录区域
      if (box.closest && box.closest(BANNER_EXCLUDE)) continue;    // 首页轮播交给板块级开关
      if (box.closest && box.closest(AD_SLOT_SELECTOR)) continue;  // 广告位的身份由 isAdSlot 直接认定

      var label = box.querySelector('.floor-title') || box;
      var badge = cleanText(label);
      if (!badge || badge.length > 8) continue;

      var hit = null;
      for (var b = 0; b < TYPES.length; b++) {
        var words = typeBadges(TYPES[b]);
        for (var w = 0; w < words.length; w++) {
          if (badge.indexOf(words[w]) !== -1) { hit = TYPES[b]; break; }
        }
        if (hit) break;
      }
      if (!hit) continue;

      var card = resolveBadgeCard(box, hit.href || /(?!)/);
      if (!card) continue;   // 无法确认是一张卡片 → 宁可不屏蔽
      if (!card.matches || !card.matches(CARD_SELECTOR)) trackedCards.add(card);
      if (card.dataset.bfState === 'blocked') continue;
      if (insideBlockedCard(card)) continue;
      processCard(card);
      handled++;
    }
  }

  /**
   * 广告扫描：广告位既不在 CARD_SELECTOR 里、又常常把标题挂在外面，
   * 所以单独一趟，统一先收成"要处理的那一块"（见 adSlotTarget）再交给 processCard。
   *
   * **一块广告只处理最外层那一个节点**：AD_SLOT_SELECTOR 会同时命中嵌套的多个元素
   * （实测一条条幅广告是这样：`.ad-report.strip-ad.left-banner` > `.ad-report-inner`；
   * 右栏广告卡是 `.video-card-ad-small` > `.ad-report` > `.ad-report-inner` > `.ad-floor-cover`）。
   * 以前每个节点各算一次目标，于是同一块广告被标了好几次、遮罩里套遮罩 ——
   * 实测遮蔽模式下 4 块广告出了 12 个遮罩，其中还包含 888×22、350×14 这种"一条线"的退化遮罩
   * （反馈里"遮罩不到位""悬停显示不对"就是这个）。现在不是最外层的广告节点直接跳过。
   *
   * 收出来的块同样记进 trackedCards：它们不是 CARD_SELECTOR 匹配到的卡片，
   * 关掉「广告」开关时要靠这份记录恢复原状。
   */
  var AD_ANY_SELECTOR = AD_SLOT_SELECTOR + ',' + PLAYER_BANNER_INNER_SELECTOR + ',.inside-wrp';

  /** 这个广告节点是不是"最外层的那一个"（祖先里还有广告节点就说明不是） */
  function isOutermostAdNode(el) {
    var p = el.parentElement;
    if (!p || !p.closest) return true;
    return !p.closest(AD_ANY_SELECTOR);
  }

  function scanAdSlots() {
    if (!settings.enabled) return;
    var hasKeywords = !!(settings.keywords && settings.keywords.length);
    // 没开广告开关、也没屏蔽词时不用扫；但开着调试日志时仍然扫一遍，
    // 否则"广告认出来了但开关没开"这条诊断永远不会打印（反馈里就是这么卡住的）
    if (!(settings.blockTypes && settings.blockTypes.ad) && !hasKeywords && !settings.debug) return;

    var nodes = document.querySelectorAll(AD_ANY_SELECTOR);
    var seen = [];
    for (var i = 0; i < nodes.length; i++) {
      var slot = nodes[i];
      if (isChromeRegion(slot)) continue;   // 顶栏 / 导航里的东西一律跳过（反馈过的 bug：顶栏被遮）
      if (!isOutermostAdNode(slot)) continue;   // 同一块广告只处理最外层，避免重复遮罩
      var target = adSlotTarget(slot);
      if (!target) continue;
      // 外壳的身份明确标出来（见 isAdSlot）：光看类名认不出来，也不能靠"里面装着广告"来猜
      if (target !== slot && target.dataset) target.dataset.bfAdFrame = '1';
      if (seen.indexOf(target) !== -1) continue;   // 嵌套的广告位会收敛到同一块，只处理一次
      seen.push(target);
      trackedCards.add(target);
      if (target.dataset.bfState === 'blocked') continue;   // 已屏蔽，跳过
      // 广告位要绕过 isNestedCard：那个判断看的是"祖先有没有被处理过（data-bf-card）"，
      // 而 clearBlock 会给没屏蔽的卡片也打上这个标记 —— 页面上一旦有容器被误判成卡片，
      // 里面的广告位就永远轮不到处理（实测反馈里横幅怎么都不屏蔽，就是这条卡住的）。
      // 真正被遮住的祖先仍然要跳过，否则会在遮罩里再套一块遮罩。
      if (insideBlockedCard(target)) continue;
      processCard(target, { ad: true });
    }
  }

  function scanAll(force) {
    fullScan(force);
    scanTypedCards();
    scanBadgeCards();
    scanAdSlots();

    // 设置变更时，把通用识别找到过的卡片也重新判定一遍（否则关掉开关后无法恢复）
    if (force && trackedCards.size) {
      trackedCards.forEach(function (card) {
        if (!card.isConnected) { trackedCards.delete(card); return; }
        if (!card.matches || !card.matches(CARD_SELECTOR)) processCard(card, { ad: isAdSlot(card) });
      });
    }

    var now = Date.now();
    if (force || now - lastSectionScanAt > 800) {
      lastSectionScanAt = now;
      applyBannerBlock();
      applyPlaceholderCollapse();
    }
  }

  function flush() {
    flushTimer = null;
    if (dirtyCards.size) {
      var cards = Array.from(dirtyCards);
      dirtyCards.clear();
      for (var i = 0; i < cards.length; i++) {
        if (cards[i].isConnected) processCard(cards[i]);
      }
    }
    if (pendingFullScan) {
      pendingFullScan = false;
      scanAll(false);
    }
    // 占位项一旦被真实内容填充就要立刻恢复，不能等到下一次轮询
    applyPlaceholderCollapse();
  }

  function scheduleFlush() {
    if (flushTimer) return;
    flushTimer = setTimeout(flush, 180);
  }

  /** 节点内是否藏着"分区推广"链接：推广卡片不是 CARD_SELECTOR 那种结构，只能靠链接发现 */
  function containsTypedAnchor(node) {
    if (!node || !node.querySelectorAll) return false;
    var anchors = node.querySelectorAll('a[href]');
    for (var i = 0; i < anchors.length && i < 20; i++) {
      var href = anchors[i].getAttribute('href') || '';
      for (var j = 0; j < TYPES.length; j++) {
        if (TYPES[j].href && TYPES[j].href.test(href)) return true;
      }
    }
    return false;
  }

  function markDirty(node) {
    if (!node || node.nodeType !== 1) return;
    if (node.classList && (node.classList.contains('bf-mask') || node.classList.contains('bf-banner-blocked'))) return;
    if (node.closest && node.closest('.bf-mask')) return;

    var card = node.closest ? node.closest('[data-bf-card]') : null;
    if (card) {
      dirtyCards.add(card);
      if (dirtyCards.size > 400) dirtyCards.clear();
      return;
    }
    // 新增节点本身就是卡片时也要触发扫描
    if (node.matches && node.matches(CARD_SELECTOR)) {
      pendingFullScan = true;
      return;
    }
    if (node.querySelector && node.querySelector(CARD_SELECTOR)) pendingFullScan = true;
    // 广告位与播放器活动横幅都是懒加载进来的，也不在 CARD_SELECTOR 里，同样要能被发现
    else if (node.querySelector && node.querySelector(AD_SLOT_SELECTOR)) pendingFullScan = true;
    else if (node.querySelector && node.querySelector(PLAYER_BANNER_INNER_SELECTOR)) pendingFullScan = true;
    // 懒加载进来的推广卡片（.floor-card-inner 这类）不在 CARD_SELECTOR 里，
    // 只能靠"里面有没有分区链接"来发现，否则要等到用户滚动才会被扫到
    else if (containsTypedAnchor(node)) pendingFullScan = true;
  }

  function startObservers() {
    var observer = new MutationObserver(function (mutations) {
      for (var i = 0; i < mutations.length; i++) {
        var m = mutations[i];
        if (!m.target || !m.target.isConnected) continue;
        markDirty(m.target);
        for (var j = 0; j < m.addedNodes.length; j++) {
          var n = m.addedNodes[j];
          if (n.nodeType !== 1) continue;
          if (n.classList && (n.classList.contains('bf-mask') || n.classList.contains('bf-mask-chip'))) continue;
          markDirty(n);
        }
      }
      scheduleFlush();
    });

    observer.observe(document.documentElement, { childList: true, subtree: true });

    ['popstate', 'pushstate', 'replacestate', 'pjax:end', 'visibilitychange'].forEach(function (evt) {
      window.addEventListener(evt, function () {
        setTimeout(function () { scanAll(true); }, 300);
      }, true);
    });
    window.addEventListener('scroll', function () {
      var now = Date.now();
      if (pendingFullScan || now - lastScanAt < 1000) return;
      lastScanAt = now;
      pendingFullScan = true;
      scheduleFlush();
    }, { passive: true, capture: true });
  }

  function hookHistory() {
    ['pushState', 'replaceState'].forEach(function (name) {
      var orig = history[name];
      if (!orig || orig.__bfHooked) return;
      var wrapped = function () {
        var r = orig.apply(this, arguments);
        window.dispatchEvent(new Event(name === 'pushState' ? 'pushstate' : 'replacestate'));
        return r;
      };
      wrapped.__bfHooked = true;
      history[name] = wrapped;
    });
  }

  /* ------------------------------------------------------------------
   * 统计
   * ------------------------------------------------------------------ */

  var statTimer = null;
  var pendingStat = 0;

  function bumpStat(delta) {
    pendingStat += delta;
    if (statTimer) return;
    statTimer = setTimeout(function () {
      statTimer = null;
      var d = pendingStat;
      pendingStat = 0;
      try {
        chrome.runtime.sendMessage({ type: 'BF_STATS', delta: d }, function () { void chrome.runtime.lastError; });
      } catch (e) { /* 扩展被重载时忽略 */ }
      updateStatsLabel();
    }, 800);
  }

  function updateStatsLabel() {
    var el = shadow && shadow.getElementById('bf-stats');
    if (el) el.textContent = '本次屏蔽 ' + sessionBlocked + ' 个 · 累计 ' + totalBlocked;
  }

  /* ------------------------------------------------------------------
   * 深色模式检测
   * ------------------------------------------------------------------ */

  function detectDark() {
    var html = document.documentElement;
    if (!html) return false;

    if (html.hasAttribute('dark')) return true;
    var attr = (html.getAttribute('data-theme') || html.getAttribute('theme') || '').toLowerCase();
    if (attr === 'dark') return true;
    if (attr === 'light') return false;
    if (html.classList.contains('dark') || html.classList.contains('dark-theme')) return true;
    if (html.classList.contains('light') || html.classList.contains('light-theme')) return false;

    var body = document.body;
    if (body) {
      var lum = bgLuminance(getComputedStyle(body).backgroundColor);
      if (lum !== null) return lum < 0.45;
    }
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  function refreshTheme() {
    var dark = detectDark();
    if (dark === isDark) return;
    isDark = dark;
    document.documentElement.classList.toggle('bf-dark', dark);
    updateHostTheme();
    log('深色模式：', dark);
  }

  function effectiveTheme() {
    if (settings.theme === 'dark') return 'dark';
    if (settings.theme === 'light') return 'light';
    return isDark ? 'dark' : 'light';
  }

  function updateHostTheme() {
    if (hostEl) hostEl.setAttribute('data-theme', effectiveTheme());
  }

  /* ------------------------------------------------------------------
   * 页面内悬浮面板（Shadow DOM 隔离样式，可拖动）
   * ------------------------------------------------------------------ */

  var PANEL_CSS = [
    ':host { all: initial; }',
    '* { box-sizing: border-box; }',
    ':host {',
    '  position: fixed; z-index: 2147483000;',
    '  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", "PingFang SC", sans-serif;',
    '  font-size: 13px; line-height: 1.5; color: #18191c;',
    '}',
    ':host([data-theme="dark"]) { color: #e8eaed; }',
    '.bf-root { position: relative; }',
    '.bf-btn {',
    '  display: inline-flex; align-items: center; gap: 6px;',
    '  height: 34px; padding: 0 12px;',
    '  border: 1px solid rgba(0,0,0,.08); border-radius: 17px;',
    '  background: #fff; color: inherit; font-size: 13px; font-family: inherit;',
    '  box-shadow: 0 2px 8px rgba(0,0,0,.08);',
    '  transition: background-color .15s ease, border-color .15s ease;',
    '  white-space: nowrap; cursor: grab; touch-action: none; user-select: none;',
    '}',
    '.bf-btn:hover { background: #f1f3f5; }',
    '.bf-btn.bf-dragging { cursor: grabbing; opacity: .92; }',
    ':host([data-theme="dark"]) .bf-btn { background: #2b2c2f; border-color: rgba(255,255,255,.12); box-shadow: 0 2px 8px rgba(0,0,0,.4); }',
    ':host([data-theme="dark"]) .bf-btn:hover { background: #35373b; }',
    '.bf-btn__icon { width: 16px; height: 16px; display: block; flex: none; }',
    '.bf-btn__count {',
    '  min-width: 18px; height: 18px; padding: 0 5px; border-radius: 9px;',
    '  background: #00aeec; color: #fff; font-size: 11px; line-height: 18px; text-align: center;',
    '}',
    '.bf-btn__count[hidden] { display: none; }',
    '.bf-btn.is-off { opacity: .62; }',

    '.bf-panel {',
    '  position: fixed; width: 320px; max-width: calc(100vw - 24px);',
    '  background: #fff; color: #18191c;',
    '  border: 1px solid rgba(0,0,0,.08); border-radius: 12px;',
    '  box-shadow: 0 8px 32px rgba(0,0,0,.16);',
    '  overflow: hidden;',
    '}',
    ':host([data-theme="dark"]) .bf-panel { background: #232427; color: #e8eaed; border-color: rgba(255,255,255,.1); box-shadow: 0 8px 32px rgba(0,0,0,.6); }',
    '.bf-panel[hidden] { display: none; }',
    '.bf-head { display: flex; align-items: center; gap: 8px; padding: 12px 14px; border-bottom: 1px solid rgba(0,0,0,.06); }',
    ':host([data-theme="dark"]) .bf-head { border-bottom-color: rgba(255,255,255,.08); }',
    '.bf-head__title { font-weight: 600; font-size: 14px; flex: 1; }',
    '.bf-body { padding: 4px 14px 12px; max-height: min(70vh, 560px); overflow-y: auto; }',
    '.bf-row { padding: 10px 0; border-bottom: 1px solid rgba(0,0,0,.05); }',
    ':host([data-theme="dark"]) .bf-row { border-bottom-color: rgba(255,255,255,.06); }',
    '.bf-row:last-child { border-bottom: none; }',
    '.bf-label { font-size: 12px; color: #9499a0; margin-bottom: 8px; display: flex; align-items: center; justify-content: space-between; }',
    '.bf-seg { display: flex; background: #f1f2f3; border-radius: 8px; padding: 3px; gap: 3px; }',
    ':host([data-theme="dark"]) .bf-seg { background: #17181a; }',
    '.bf-seg button {',
    '  flex: 1; height: 30px; border: 0; border-radius: 6px; background: transparent;',
    '  cursor: pointer; font-size: 12px; color: #61666d; font-family: inherit;',
    '}',
    '.bf-seg button:hover { color: #18191c; }',
    ':host([data-theme="dark"]) .bf-seg button { color: #a2a7ae; }',
    ':host([data-theme="dark"]) .bf-seg button:hover { color: #fff; }',
    '.bf-seg button.is-active { background: #fff; color: #00aeec; font-weight: 600; box-shadow: 0 1px 4px rgba(0,0,0,.1); }',
    ':host([data-theme="dark"]) .bf-seg button.is-active { background: #34363a; color: #24b3f0; }',
    '.bf-input-row { display: flex; gap: 6px; }',
    '.bf-input {',
    '  flex: 1; min-width: 0; height: 32px; padding: 0 10px; border-radius: 8px;',
    '  border: 1px solid #dcdfe6; background: #fff; color: inherit; font-size: 12px; font-family: inherit; outline: none;',
    '}',
    '.bf-input:focus { border-color: #00aeec; }',
    ':host([data-theme="dark"]) .bf-input { background: #17181a; border-color: #3a3c3f; color: #e8eaed; }',
    '.bf-btn-primary {',
    '  height: 32px; padding: 0 12px; border: 0; border-radius: 8px; cursor: pointer;',
    '  background: #00aeec; color: #fff; font-size: 12px; font-family: inherit; flex: none;',
    '}',
    '.bf-btn-primary:hover { background: #0a9fd6; }',
    '.bf-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }',
    '.bf-chip {',
    '  display: inline-flex; align-items: center; gap: 4px; max-width: 100%;',
    '  padding: 3px 6px 3px 8px; border-radius: 6px; font-size: 12px;',
    '  background: #f1f2f3; color: #18191c;',
    '}',
    ':host([data-theme="dark"]) .bf-chip { background: #34363a; color: #e8eaed; }',
    '.bf-chip__text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 180px; }',
    '.bf-chip__del {',
    '  border: 0; background: transparent; cursor: pointer; color: #9499a0;',
    '  font-size: 13px; line-height: 1; padding: 0 2px; font-family: inherit;',
    '}',
    '.bf-chip__del:hover { color: #f25d8e; }',
    '.bf-empty { font-size: 12px; color: #9499a0; margin-top: 8px; }',
    '.bf-types { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }',
    '.bf-type {',
    '  display: flex; align-items: center; justify-content: center; gap: 4px;',
    '  height: 30px; border-radius: 8px; cursor: pointer; user-select: none;',
    '  background: #f1f2f3; color: #61666d; font-size: 12px; border: 1px solid transparent;',
    '  padding: 0 6px; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;',
    '}',
    ':host([data-theme="dark"]) .bf-type { background: #2b2c2f; color: #a2a7ae; }',
    '.bf-type.is-active { background: rgba(0,174,236,.12); border-color: #00aeec; color: #00aeec; font-weight: 600; }',
    ':host([data-theme="dark"]) .bf-type.is-active { color: #24b3f0; }',
    '.bf-subrow {',
    '  display: flex; align-items: center; justify-content: space-between; gap: 8px;',
    '  margin-top: 10px; padding-top: 10px; border-top: 1px dashed rgba(0,0,0,.08);',
    '  font-size: 12px; color: #61666d;',
    '}',
    ':host([data-theme="dark"]) .bf-subrow { border-top-color: rgba(255,255,255,.1); color: #a2a7ae; }',
    '.bf-switch { position: relative; width: 40px; height: 22px; border-radius: 11px; border: 0; cursor: pointer; background: #c9ccd0; transition: background-color .15s ease; flex: none; padding: 0; }',
    '.bf-switch::after { content: ""; position: absolute; top: 2px; left: 2px; width: 18px; height: 18px; border-radius: 50%; background: #fff; transition: transform .15s ease; }',
    '.bf-switch.is-on { background: #00aeec; }',
    '.bf-switch.is-on::after { transform: translateX(18px); }',
    '.bf-switch--sm { width: 34px; height: 19px; }',
    '.bf-switch--sm::after { width: 15px; height: 15px; }',
    '.bf-switch--sm.is-on::after { transform: translateX(15px); }',
    '.bf-foot {',
    '  display: flex; align-items: center; justify-content: space-between; gap: 8px;',
    '  padding: 10px 14px; background: #fafafa; border-top: 1px solid rgba(0,0,0,.06);',
    '  font-size: 12px; color: #9499a0;',
    '}',
    ':host([data-theme="dark"]) .bf-foot { background: #1d1e20; border-top-color: rgba(255,255,255,.08); }',
    '.bf-foot__actions { display: flex; align-items: center; gap: 10px; }',
    '.bf-link { border: 0; background: transparent; color: #00aeec; cursor: pointer; font-size: 12px; font-family: inherit; padding: 0; }',
    '.bf-link:hover { text-decoration: underline; }',
    '.bf-hint { font-size: 11px; color: #9499a0; margin-top: 6px; }',
    '.bf-hint.is-warn { color: #f25d8e; font-weight: 600; }'
  ].join('\n');

  var PANEL_HTML = [
    '<div class="bf-root">',
    '  <button class="bf-btn" id="bf-toggle" type="button" title="B站屏蔽助手（按住可拖动）">',
    '    <span class="bf-btn__icon">' + MASK_ICON_SVG + '</span>',
    '    <span>屏蔽助手</span>',
    '    <span class="bf-btn__count" id="bf-btn-count" hidden>0</span>',
    '  </button>',
    '  <div class="bf-panel" id="bf-panel" hidden>',
    '    <div class="bf-head">',
    '      <span class="bf-head__title">B站屏蔽助手</span>',
    '      <button class="bf-switch" id="bf-enabled" type="button" role="switch" title="启用/停用"></button>',
    '    </div>',
    '    <div class="bf-body">',
    '      <div class="bf-row">',
    '        <div class="bf-label"><span>屏蔽方式</span></div>',
    '        <div class="bf-seg" id="bf-mode">',
    '          <button type="button" data-value="mask">整体遮蔽</button>',
    '          <button type="button" data-value="hide">完全隐藏</button>',
    '        </div>',
    '        <div class="bf-hint" id="bf-mode-hint"></div>',
    '        <div class="bf-subrow" id="bf-keepslot-row">',
    '          <span>隐藏时保留原位置</span>',
    '          <button class="bf-switch bf-switch--sm" id="bf-keepslot" type="button" role="switch"></button>',
    '        </div>',
    '      </div>',
    '      <div class="bf-row">',
    '        <div class="bf-label"><span>标题屏蔽词</span></div>',
    '        <div class="bf-input-row">',
    '          <input class="bf-input" id="bf-kw-input" type="text" placeholder="输入后回车，支持逗号分隔多个" />',
    '          <button class="bf-btn-primary" id="bf-kw-add" type="button">添加</button>',
    '        </div>',
    '        <div class="bf-chips" id="bf-chips"></div>',
    '      </div>',
    '      <div class="bf-row">',
    '        <div class="bf-label"><span>UP 白名单</span></div>',
    '        <div class="bf-input-row">',
    '          <input class="bf-input" id="bf-wl-input" type="text" placeholder="UP 名（要和卡片上显示的完全一致），回车添加" />',
    '          <button class="bf-btn-primary" id="bf-wl-add" type="button">添加</button>',
    '        </div>',
    '        <div class="bf-chips" id="bf-wl-chips"></div>',
    '        <div class="bf-hint">名单里的 UP 不会被屏蔽，关键词和分区开关都对它无效</div>',
    '      </div>',
    '      <div class="bf-row">',
    '        <div class="bf-label"><span>屏蔽分区推广（卡片）</span></div>',
    '        <div class="bf-types" id="bf-types"></div>',
    '        <div class="bf-subrow">',
    '          <span>屏蔽首页顶部轮播横幅</span>',
    '          <button class="bf-switch bf-switch--sm" id="bf-banner" type="button" role="switch"></button>',
    '        </div>',
    '        <div class="bf-hint">打开后整块直接隐藏，不影响其它内容</div>',
    '      </div>',
    '      <div class="bf-row">',
    '        <div class="bf-label"><span>界面外观</span></div>',
    '        <div class="bf-seg" id="bf-theme">',
    '          <button type="button" data-value="auto">跟随B站</button>',
    '          <button type="button" data-value="light">浅色</button>',
    '          <button type="button" data-value="dark">深色</button>',
    '        </div>',
    '      </div>',
    '    </div>',
    '    <div class="bf-foot">',
    '      <span id="bf-stats">本次屏蔽 0 个</span>',
    '      <span class="bf-foot__actions">',
    '        <button class="bf-link" id="bf-reset-pos" type="button">重置位置</button>',
    '        <button class="bf-link" id="bf-open-options" type="button">完整设置</button>',
    '      </span>',
    '    </div>',
    '  </div>',
    '</div>'
  ].join('\n');

  function mountUI() {
    if (hostEl && hostEl.isConnected) return;
    if (!document.body) return;

    hostEl = document.createElement('div');
    hostEl.id = 'bili-filter-host';
    shadow = hostEl.attachShadow({ mode: 'open' });
    shadow.innerHTML = '<style>' + PANEL_CSS + '</style>' + PANEL_HTML;

    document.body.appendChild(hostEl);

    bindUI();
    positionHost();
    updateHostTheme();
    renderUI();
  }

  function unmountUI() {
    if (hostEl && hostEl.parentNode) hostEl.parentNode.removeChild(hostEl);
    hostEl = null;
    shadow = null;
    panelOpen = false;
  }

  function clampHostPos(left, top) {
    var w = hostEl.offsetWidth || 130;
    var h = hostEl.offsetHeight || 34;
    var vw = window.innerWidth || 1280;
    var vh = window.innerHeight || 800;
    var out = {
      left: Math.min(Math.max(8, left), Math.max(8, vw - w - 8)),
      top: Math.min(Math.max(8, top), Math.max(8, vh - h - 8))
    };
    return out;
  }

  function setHostPos(left, top) {
    if (!hostEl) return;
    var p = clampHostPos(left, top);
    hostEl.style.left = Math.round(p.left) + 'px';
    hostEl.style.top = Math.round(p.top) + 'px';
    hostEl.style.right = 'auto';
  }

  /** 默认停靠：标题栏右侧、搜索框左边；空间不足时退到标题栏下方 */
  function autoPositionHost() {
    var btnW = 130;
    var left = null;
    var top = 15;

    var rightEntry = document.querySelector('.right-entry');
    var searchBox = document.querySelector('#nav-searchform, .center-search-container, .nav-search-content');

    if (rightEntry) {
      var r = rightEntry.getBoundingClientRect();
      if (r.width > 0 && r.top < 200) left = r.left - btnW - 10;
    }
    if (searchBox) {
      var s = searchBox.getBoundingClientRect();
      if (s.width > 0 && left !== null && left < s.right + 12) left = null;
    }
    if (left === null) {
      left = window.innerWidth - btnW - 16;
      top = 74;
    }
    setHostPos(left, top);
  }

  function positionHost() {
    if (!hostEl) return;
    if (userPositioned && settings.buttonPos) {
      setHostPos(settings.buttonPos.left, settings.buttonPos.top);
      return;
    }
    autoPositionHost();
  }

  function positionPanel() {
    if (!hostEl || !shadow) return;
    var panel = shadow.getElementById('bf-panel');
    if (!panel || panel.hidden) return;

    var r = hostEl.getBoundingClientRect();
    var pw = panel.offsetWidth || 320;
    var ph = panel.offsetHeight || 420;

    var left = r.right - pw;
    if (left < 8) left = 8;
    if (left + pw > window.innerWidth - 8) left = window.innerWidth - pw - 8;

    var top = r.bottom + 8;
    if (top + ph > window.innerHeight - 8) top = Math.max(8, r.top - ph - 8);

    panel.style.left = Math.round(left) + 'px';
    panel.style.top = Math.round(top) + 'px';
  }

  function togglePanel(open) {
    if (!shadow) return;
    var panel = shadow.getElementById('bf-panel');
    if (!panel) return;
    panelOpen = typeof open === 'boolean' ? open : panel.hidden;
    panel.hidden = !panelOpen;
    if (panelOpen) {
      renderUI();
      positionPanel();
    }
  }

  /** 拖动 + 单击切换面板（移动超过阈值视为拖动，不触发开关） */
  function bindDrag(btn) {
    var dragging = false;
    var moved = false;
    var startX = 0;
    var startY = 0;
    var startLeft = 0;
    var startTop = 0;

    btn.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      dragging = true;
      moved = false;
      var r = hostEl.getBoundingClientRect();
      startX = e.clientX;
      startY = e.clientY;
      startLeft = r.left;
      startTop = r.top;
      btn.classList.add('bf-dragging');
      try { if (btn.setPointerCapture && e.pointerId != null) btn.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    });

    function onMove(e) {
      if (!dragging) return;
      var dx = e.clientX - startX;
      var dy = e.clientY - startY;
      if (!moved && Math.abs(dx) + Math.abs(dy) < 4) return;
      moved = true;
      userPositioned = true;
      setHostPos(startLeft + dx, startTop + dy);
      if (panelOpen) positionPanel();
      if (e.cancelable) e.preventDefault();
    }

    function onUp() {
      if (!dragging) return;
      dragging = false;
      btn.classList.remove('bf-dragging');
      if (moved) {
        var r = hostEl.getBoundingClientRect();
        saveButtonPos(r.left, r.top);
      } else {
        togglePanel();
      }
    }

    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  }

  function saveButtonPos(left, top) {
    var pos = { left: Math.round(left), top: Math.round(top) };
    settings.buttonPos = pos;
    userPositioned = true;
    storageSet('local', { bfButtonPos: pos });
    log('悬浮按钮位置已保存：', pos);
  }

  function resetButtonPos() {
    settings.buttonPos = null;
    userPositioned = false;
    storageSet('local', { bfButtonPos: null });
    autoPositionHost();
    if (panelOpen) positionPanel();
    renderUI();
  }

  function bindUI() {
    var toggle = shadow.getElementById('bf-toggle');
    var panel = shadow.getElementById('bf-panel');

    bindDrag(toggle);

    panel.addEventListener('click', function (e) { e.stopPropagation(); });

    // 点击面板 / 按钮以外的区域时收起面板
    document.addEventListener('click', function (e) {
      if (!panelOpen || !hostEl) return;
      var path = typeof e.composedPath === 'function' ? e.composedPath() : [];
      if (path.indexOf(hostEl) !== -1) return;
      togglePanel(false);
    }, true);

    window.addEventListener('resize', function () {
      positionHost();
      if (panelOpen) positionPanel();
    });
    window.addEventListener('scroll', function () {
      if (panelOpen) positionPanel();
    }, { passive: true, capture: true });

    shadow.getElementById('bf-enabled').addEventListener('click', function () {
      updateSettings({ enabled: !settings.enabled });
    });

    shadow.getElementById('bf-mode').addEventListener('click', function (e) {
      var b = e.target.closest('button[data-value]');
      if (b) updateSettings({ mode: b.dataset.value });
    });

    shadow.getElementById('bf-theme').addEventListener('click', function (e) {
      var b = e.target.closest('button[data-value]');
      if (b) updateSettings({ theme: b.dataset.value });
    });

    // 完全隐藏：保留原位置（v1.0.0 行为） / 移除位置
    shadow.getElementById('bf-keepslot').addEventListener('click', function () {
      updateSettings({ hideKeepSlot: !settings.hideKeepSlot });
    });

    var input = shadow.getElementById('bf-kw-input');
    shadow.getElementById('bf-kw-add').addEventListener('click', addKeywordFromInput);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); addKeywordFromInput(); }
    });

    shadow.getElementById('bf-chips').addEventListener('click', function (e) {
      var del = e.target.closest('.bf-chip__del');
      if (!del) return;
      var idx = parseInt(del.dataset.index, 10);
      var list = settings.keywords.slice();
      list.splice(idx, 1);
      updateSettings({ keywords: list });
    });

    // UP 白名单：和屏蔽词一样是"词条 + 回车添加"
    var wlInput = shadow.getElementById('bf-wl-input');
    shadow.getElementById('bf-wl-add').addEventListener('click', addWhitelistFromInput);
    wlInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); addWhitelistFromInput(); }
    });

    shadow.getElementById('bf-wl-chips').addEventListener('click', function (e) {
      var del = e.target.closest('.bf-chip__del');
      if (!del) return;
      var idx = parseInt(del.dataset.index, 10);
      var list = (settings.whitelist || []).slice();
      list.splice(idx, 1);
      updateSettings({ whitelist: list });
    });

    shadow.getElementById('bf-types').addEventListener('click', function (e) {
      var el = e.target.closest('.bf-type');
      if (!el) return;
      var key = el.dataset.key;
      var next = Object.assign({}, settings.blockTypes);
      next[key] = !next[key];
      updateSettings({ blockTypes: next });
    });

    // 首页顶部轮播横幅：独立开关，只作用于首页那一块
    shadow.getElementById('bf-banner').addEventListener('click', function () {
      updateSettings({ blockBanner: !settings.blockBanner });
    });

    shadow.getElementById('bf-reset-pos').addEventListener('click', resetButtonPos);

    shadow.getElementById('bf-open-options').addEventListener('click', function () {
      try {
        chrome.runtime.sendMessage({ type: 'BF_OPEN_OPTIONS' }, function () { void chrome.runtime.lastError; });
      } catch (err) { /* ignore */ }
      togglePanel(false);
    });
  }

  function addKeywordFromInput() {
    var input = shadow.getElementById('bf-kw-input');
    var raw = (input.value || '').trim();
    if (!raw) return;
    var parts = settings.useRegex ? [raw] : raw.split(/[,，、;；\n\r\t ]+/);
    var list = settings.keywords.slice();
    parts.forEach(function (p) {
      var v = p.trim();
      if (v && list.indexOf(v) === -1) list.push(v);
    });
    input.value = '';
    updateSettings({ keywords: list });
  }

  /** 白名单添加：逗号 / 空格 / 换行都能分隔，重复项自动跳过 */
  function addWhitelistFromInput() {
    var input = shadow.getElementById('bf-wl-input');
    var raw = (input.value || '').trim();
    if (!raw) return;
    var list = (settings.whitelist || []).slice();
    raw.split(/[,，、;；\n\r\t]+/).forEach(function (p) {
      var v = p.trim();
      if (v && list.indexOf(v) === -1) list.push(v);
    });
    input.value = '';
    updateSettings({ whitelist: list });
  }

  /** 渲染一组词条（屏蔽词与 UP 白名单共用同样的外观） */
  function renderChips(box, list, emptyText) {
    if (!box) return;
    box.innerHTML = '';
    if (!list.length) {
      var empty = document.createElement('div');
      empty.className = 'bf-empty';
      empty.textContent = emptyText;
      box.appendChild(empty);
      return;
    }
    list.forEach(function (text, i) {
      var chip = document.createElement('span');
      chip.className = 'bf-chip';
      var t = document.createElement('span');
      t.className = 'bf-chip__text';
      t.textContent = text;
      t.title = text;
      var del = document.createElement('button');
      del.className = 'bf-chip__del';
      del.type = 'button';
      del.dataset.index = String(i);
      del.textContent = '✕';
      del.title = '删除';
      chip.appendChild(t);
      chip.appendChild(del);
      box.appendChild(chip);
    });
  }

  function renderUI() {
    if (!shadow) return;

    var enabledBtn = shadow.getElementById('bf-enabled');
    enabledBtn.classList.toggle('is-on', !!settings.enabled);
    enabledBtn.setAttribute('aria-checked', settings.enabled ? 'true' : 'false');
    shadow.getElementById('bf-toggle').classList.toggle('is-off', !settings.enabled);

    var count = shadow.getElementById('bf-btn-count');
    if (sessionBlocked > 0) {
      count.hidden = false;
      count.textContent = sessionBlocked > 999 ? '999+' : String(sessionBlocked);
    } else {
      count.hidden = true;
    }

    shadow.querySelectorAll('#bf-mode button').forEach(function (b) {
      b.classList.toggle('is-active', b.dataset.value === settings.mode);
    });
    shadow.getElementById('bf-mode-hint').textContent =
      settings.mode === 'mask'
        ? (settings.revealOnHover ? '封面与标题合并为一整块，鼠标悬停可查看' : '封面与标题合并为一整块提示区域')
        : (settings.hideKeepSlot !== false ? '卡片不再显示，但原来的位置留空（页面不重排）' : '卡片整个移除，后面的内容前移补位');

    var keepSlotRow = shadow.getElementById('bf-keepslot-row');
    var keepSlotBtn = shadow.getElementById('bf-keepslot');
    // 该开关只对"完全隐藏"有意义
    keepSlotRow.style.display = settings.mode === 'hide' ? 'flex' : 'none';
    keepSlotBtn.classList.toggle('is-on', settings.hideKeepSlot !== false);
    keepSlotBtn.setAttribute('aria-checked', settings.hideKeepSlot !== false ? 'true' : 'false');

    shadow.querySelectorAll('#bf-theme button').forEach(function (b) {
      b.classList.toggle('is-active', b.dataset.value === settings.theme);
    });

    renderChips(shadow.getElementById('bf-chips'), settings.keywords,
      '还没有屏蔽词，添加后立即生效');
    renderChips(shadow.getElementById('bf-wl-chips'), settings.whitelist || [],
      '还没有白名单，添加后这些 UP 就不会被屏蔽');

    var typesBox = shadow.getElementById('bf-types');
    if (!typesBox.dataset.built) {
      TYPES.forEach(function (t) {
        var el = document.createElement('div');
        el.className = 'bf-type';
        el.dataset.key = t.key;
        el.title = t.desc;
        el.textContent = t.label;
        typesBox.appendChild(el);
      });
      typesBox.dataset.built = '1';
    }
    typesBox.querySelectorAll('.bf-type').forEach(function (el) {
      el.classList.toggle('is-active', !!settings.blockTypes[el.dataset.key]);
    });

    var bannerBtn = shadow.getElementById('bf-banner');
    bannerBtn.classList.toggle('is-on', !!settings.blockBanner);
    bannerBtn.setAttribute('aria-checked', settings.blockBanner ? 'true' : 'false');

    updateStatsLabel();
  }

  /* ------------------------------------------------------------------
   * 设置读写
   * ------------------------------------------------------------------ */

  var writeQueue = Promise.resolve();

  function updateSettings(patch) {
    settings = normalize(Object.assign({}, settings, patch));
    rebuildMatcher();
    renderUI();
    updateHostTheme();
    scanAll(true);

    writeQueue = writeQueue.then(function () {
      return storageSet('sync', { bfSettings: settings });
    });
  }

  async function initSettings() {
    var stored = await storageGet('sync', 'bfSettings');
    settings = normalize(stored.bfSettings);
    rebuildMatcher();

    var pos = await storageGet('local', 'bfButtonPos');
    if (pos && pos.bfButtonPos && isFinite(pos.bfButtonPos.left) && isFinite(pos.bfButtonPos.top)) {
      settings.buttonPos = { left: Number(pos.bfButtonPos.left), top: Number(pos.bfButtonPos.top) };
      userPositioned = true;
    } else if (settings.buttonPos) {
      userPositioned = true;
    }

    var stats = await storageGet('local', 'bfStats');
    totalBlocked = (stats.bfStats && stats.bfStats.total) || 0;
  }

  function watchStorage() {
    chrome.storage.onChanged.addListener(function (changes, area) {
      if (area === 'sync' && changes.bfSettings) {
        var next = normalize(changes.bfSettings.newValue);
        if (JSON.stringify(next) === JSON.stringify(settings)) return;
        settings = next;
        rebuildMatcher();
        renderUI();
        updateHostTheme();
        scanAll(true);
        return;
      }
      if (area === 'local' && changes.bfButtonPos) {
        var v = changes.bfButtonPos.newValue;
        if (v && isFinite(v.left) && isFinite(v.top)) {
          settings.buttonPos = { left: Number(v.left), top: Number(v.top) };
          userPositioned = true;
          positionHost();
        }
        return;
      }
      if (area === 'local' && changes.bfStats) {
        totalBlocked = (changes.bfStats.newValue && changes.bfStats.newValue.total) || 0;
        updateStatsLabel();
      }
    });

    try {
      chrome.runtime.onMessage.addListener(function (msg) {
        if (msg && msg.type === 'BF_RESCAN') scanAll(true);
      });
    } catch (e) { /* ignore */ }
  }

  /* ------------------------------------------------------------------
   * 启动
   * ------------------------------------------------------------------ */

  function tick() {
    refreshTheme();

    // 完全隐藏模式下定期复核：占位项被真实内容填充后要能自动恢复。
    // 节流到 ~2.5s，避免每次轮询都重新计算（变更防抖回调里已经会即时复核）
    // 只有"移除位置"模式才会把空占位块顶上来，这时才需要定期复核
    if (settings.enabled && settings.mode === 'hide' && settings.hideKeepSlot === false) {
      var now = Date.now();
      if (now - lastPlaceholderCheck > 1500) {
        lastPlaceholderCheck = now;
        applyPlaceholderCollapse();
      }
    }

    if (settings.showHeaderButton && document.body) {
      if (!hostEl || !hostEl.isConnected) mountUI();
      else if (!userPositioned) autoPositionHost();
    } else if (hostEl && hostEl.isConnected) {
      unmountUI();
    }
  }

  async function init() {
    hookHistory();
    await initSettings();
    watchStorage();
    startObservers();

    refreshTheme();

    var ready = function () {
      mountUI();
      scanAll(true);
      setInterval(tick, 1200);
      if (window.matchMedia) {
        try {
          window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', refreshTheme);
        } catch (e) { /* 老版本 Edge 忽略 */ }
      }
      log('已启动，屏蔽词数量：', settings.keywords.length);
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', ready, { once: true });
    } else {
      ready();
    }
  }

  init();
})();
