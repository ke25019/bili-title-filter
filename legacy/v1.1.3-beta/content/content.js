/**
 * B站屏蔽助手 - 内容脚本  v1.1.0
 * ---------------------------------------------------------------
 * 功能：
 *  1. 按用户自定义的「标题屏蔽词」屏蔽视频卡片
 *  2. 两种屏蔽方式：
 *     - mask：把封面 + 标题合成一整块「根据您的屏蔽词已将此视频屏蔽」区域
 *             （鼠标悬停可临时查看该视频）
 *     - hide：直接从页面上移除，就像这个视频没出现过
 *  3. 分区推广屏蔽，两个粒度各自独立开关：
 *     - 卡片级 blockTypes   ：屏蔽该分区的每一张卡片
 *     - 板块级 blockSections：屏蔽该分区所在的整行 / 整个推广位（含轮播横幅）
 *  4. 标题栏附近的悬浮面板可自由拖动，位置自动记忆
 *  5. 自动适配 B 站 web 端深色模式
 *
 * 分区识别策略（不依赖单一 class，B 站改版不易失效）：
 *   a) 先看卡片内链接指向哪个站（live.bilibili.com / bangumi / cheese ...）
 *   b) 再看卡片 class（使用实测到的真实类名兜底）
 *   c) 若卡片本身不在已知卡片选择器里，则从命中的 <a> 向上自动推断卡片容器
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
    /* 注意：.floor-card / .floor-single-card 是"楼层区块"而不是单张卡片，
       它们只作为板块级屏蔽的落点（见 SECTION_HINT_SELECTOR），
       内部的具体卡片由通用分区识别负责，避免卡片级误遮一整块区域。 */
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

  /** 顶栏 / 导航区域：分区识别时必须跳过，否则会把「直播」入口当成直播卡片 */
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
    '.bili-dropdown'
  ].join(',');

  /** 卡片容器语义提示（用于从链接向上推断卡片） */
  var CARD_HINT_RE = /card|item|module|entry|video|live|bangumi|pgc|media|floor|short|cover/i;

  /** 板块容器语义提示（板块级屏蔽的落点） */
  var SECTION_HINT_SELECTOR = [
    '.floor-card',
    '.floor-single-card',
    '.carousel-area',
    '.carousel-container',
    '.anime-list',
    '[class*="floor-"]',
    '[class*="carousel"]',
    '[class*="banner"]'
  ].join(',');

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

  function getTitle(card) {
    for (var i = 0; i < TITLE_SELECTORS.length; i++) {
      var el = card.querySelector(TITLE_SELECTORS[i]);
      if (!el) continue;
      var t = textOf(el);
      if (t) return t;
    }
    var anchor = card.querySelector('a[title]');
    if (anchor) {
      var at = anchor.getAttribute('title');
      if (at && at.trim()) return at.trim();
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

  function hasTitleInside(el) {
    for (var i = 0; i < TITLE_SELECTORS.length; i++) {
      if (el.querySelector(TITLE_SELECTORS[i])) return true;
    }
    return false;
  }

  /** 判定元素是不是"列表 / 板块"而不是"一张卡片" */
  function isListNode(el, hrefRe) {
    if (!el || el === document.body || el === document.documentElement) return true;
    if (countDistinctEntries(el, hrefRe) > 1) return true;
    if (el.matches && el.matches(SECTION_HINT_SELECTOR)) return true;
    if (countTopCards(el) > 1) return true;
    return false;
  }

  /** 尺寸明显不可能是单张卡片（真实浏览器里才有效，jsdom 中 rect 为 0 会跳过） */
  function isAbsurdSize(el, factor) {
    if (!el || !el.getBoundingClientRect) return false;
    var r = el.getBoundingClientRect();
    if (!r || !r.width || !r.height) return false;
    var vw = window.innerWidth || 1280;
    var vh = window.innerHeight || 800;
    var f = factor || 1;
    if (r.height > vh * 1.5 * f) return true;
    if (r.width > vw * 1.2 * f) return true;
    return false;
  }

  /** B 站用 BEM 命名：bili-live-card__image--link 的块根是 bili-live-card */
  function bemRootOf(el) {
    var cls = typeof el.className === 'string' ? el.className : '';
    var m = /(?:^|\s)([a-z0-9-]+?)__/i.exec(cls);
    return m ? m[1] : null;
  }

  /** 遮蔽要覆盖「封面 + 标题」，只有封面时向上补到含标题的那一层 */
  function expandToTitle(el, hrefRe) {
    var cur = el;
    for (var i = 0; i < 3 && cur && cur.parentElement && cur.parentElement !== document.body; i++) {
      if (hasTitleInside(cur)) return cur;
      var parent = cur.parentElement;
      if (isListNode(parent, hrefRe) || isAbsurdSize(parent)) break;
      cur = parent;
    }
    return cur || el;
  }

  /** 从命中的链接推断「该卡片」容器 —— 关键在于绝不把列表/整块区域当成卡片 */
  function pickCardContainer(a, hrefRe) {
    // 1) 已经在已知卡片选择器内：取最外层那一个卡片
    var known = a.closest(CARD_SELECTOR);
    if (known && !isListNode(known, hrefRe)) {
      var outer = known;
      while (outer.parentElement && outer.parentElement.matches &&
             outer.parentElement.matches(CARD_SELECTOR) &&
             !isListNode(outer.parentElement, hrefRe)) {
        outer = outer.parentElement;
      }
      return expandToTitle(outer, hrefRe);
    }

    // 2) BEM 块根：bili-live-card__image--link -> .bili-live-card
    var root = bemRootOf(a);
    if (root) {
      var byRoot = a.closest('.' + root);
      if (byRoot && !isListNode(byRoot, hrefRe) && !isAbsurdSize(byRoot)) {
        return expandToTitle(byRoot, hrefRe);
      }
    }

    // 3) 通用向上推断：一遇到列表容器或过大容器立即停手
    var el = a;
    var best = null;
    var last = null;
    for (var d = 0; el && el !== document.body && el !== document.documentElement && d < 8; d++) {
      if (isListNode(el, hrefRe) || isAbsurdSize(el)) break;
      var cls = typeof el.className === 'string' ? el.className : '';
      if (CARD_HINT_RE.test(cls)) best = el;
      if (d <= 2) last = el;
      el = el.parentElement;
    }
    return expandToTitle(best || last || a, hrefRe);
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

  /**
   * 判定卡片属于哪个分区 / 类型。
   * 「其他推广」只在该卡片没有命中任何具体分区时才生效，
   * 这样关掉某个分区开关时不会又被兜底规则抓回来。
   */
  function detectType(card) {
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
   * 板块（整行 / 推广位）解析
   * ------------------------------------------------------------------ */

  function isOversized(el, hrefRe) {
    if (countDistinctEntries(el, hrefRe) > 12) return true;
    if (!el.getBoundingClientRect) return false;
    var r = el.getBoundingClientRect();
    if (!r || !r.width || !r.height) return false;
    var vw = window.innerWidth || 1280;
    var vh = window.innerHeight || 800;
    if (r.height > vh * 1.2) return true;
    if (r.width > vw * 0.98 && r.height > vh * 0.5) return true;
    return false;
  }

  /**
   * 判定一个容器是不是"该分区的整行板块"。
   * 关键防线：如果里面还夹着别的非本分区卡片（典型就是整个推荐流），
   * 那就绝对不是"一行"，必须拒绝，否则会把整页藏掉。
   */
  function isSoundSection(el, type) {
    if (!el || el === document.body || el === document.documentElement) return false;
    var entries = countDistinctEntries(el, type.href);
    if (entries < 2 || entries > 12) return false;
    if (el.children && el.children.length > 40) return false;

    var cards = el.querySelectorAll(CARD_SELECTOR);
    var foreign = 0;
    for (var i = 0; i < cards.length; i++) {
      if (countDistinctEntries(cards[i], type.href) === 0) {
        foreign++;
        if (foreign > 2) return false;
      }
    }
    return !isOversized(el, type.href);
  }

  /** 语义板块容器：取最外层的那个（顶部轮播横幅等） */
  function widestHint(a, type) {
    var hintSel = (type.block ? type.block + ', ' : '') + SECTION_HINT_SELECTOR;
    var hint = a.closest(hintSel);
    while (hint && hint.parentElement) {
      var outer = hint.parentElement.closest ? hint.parentElement.closest(hintSel) : null;
      if (!outer || isOversized(outer, type.href)) break;
      hint = outer;
    }
    return hint;
  }

  /** 找到该链接所属的"整行板块"容器；找不到就返回 null（宁可不屏蔽，也不乱屏蔽） */
  function findSectionRoot(a, type) {
    var el = a.parentElement;
    for (var d = 0; el && el !== document.body && el !== document.documentElement && d < 12; d++) {
      if (isSoundSection(el, type)) return el;                  // 取最内层的合格"一行"
      if (countDistinctEntries(el, type.href) > 12) break;      // 已经扩到整页级别
      el = el.parentElement;
    }

    // 单条目的推广位（顶部轮播横幅 / 楼层区块）走语义容器
    var hint = widestHint(a, type);
    if (hint && !isOversized(hint, type.href)) return hint;

    return null;
  }

  /** 板块本体 + 它旁边的标题元素 */
  function sectionElements(root) {
    var out = [root];
    var parent = root.parentElement;
    if (!parent) return out;
    for (var i = 0; i < parent.children.length; i++) {
      var sib = parent.children[i];
      if (sib === root) continue;
      var cls = typeof sib.className === 'string' ? sib.className : '';
      var looksHeading = /title|header|head|name|more|sub-title/i.test(cls) || /^H[1-6]$/.test(sib.tagName);
      if (!looksHeading) continue;
      if (sib.querySelector('a[href]')) continue;   // 有链接的多半是内容，不动它
      var text = (sib.textContent || '').trim();
      if (!text || text.length > 60) continue;
      out.push(sib);
    }
    return out;
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
    // 安全阀：尺寸显然不可能是单张卡片时，宁可不屏蔽，也绝不制造页面空白
    if (isAbsurdSize(card)) {
      log('跳过尺寸异常的容器（避免页面空白）：', card.className, action.key);
      return;
    }

    var already = card.dataset.bfState === 'blocked' && card.dataset.bfKey === action.key;
    if (already) {
      // 命中原因没变，但屏蔽方式 / 文案 / 悬停展示等设置可能变了，这里同步刷新
      card.dataset.bfCard = '1';
      card.classList.toggle('bf-hide', settings.mode === 'hide');
      card.classList.toggle('bf-hoverable', !!settings.revealOnHover);
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
    card.classList.toggle('bf-hide', settings.mode === 'hide');
    card.classList.toggle('bf-hoverable', !!settings.revealOnHover);

    ensureMask(card, action);
    bindHoverReveal(card);
    updateCompact(card);

    sessionBlocked += 1;
    bumpStat(1);
    log('已屏蔽：', action.key, getTitle(card));
  }

  function clearBlock(card) {
    card.dataset.bfCard = '1';
    if (card.dataset.bfState !== 'blocked') return;

    card.classList.remove('bf-blocked', 'bf-hide', 'bf-hoverable', 'bf-revealed', 'bf-compact');
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

  function processCard(card) {
    if (isNestedCard(card)) return;

    if (!settings.enabled) {
      clearBlock(card);
      return;
    }

    var type = detectType(card);

    if (settings.blockTypes && settings.blockTypes[type]) {
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
   */
  function scanTypedCards() {
    if (!settings.enabled) return;
    var enabled = TYPES.filter(function (t) { return settings.blockTypes[t.key]; });
    if (!enabled.length) return;

    var anchors = document.querySelectorAll('a[href]');
    var handled = 0;
    for (var i = 0; i < anchors.length && handled < 300; i++) {
      var a = anchors[i];
      if (isExcludedAnchor(a)) continue;
      if (a.closest && a.closest(BANNER_EXCLUDE)) continue;   // 横幅交给板块级开关
      var href = a.getAttribute('href') || '';
      var hit = null;
      for (var j = 0; j < enabled.length; j++) {
        if (enabled[j].href.test(href)) { hit = enabled[j]; break; }
      }
      if (!hit) continue;

      var card = pickCardContainer(a, hit.href);
      if (!card) continue;
      // 记住这类卡片：它们不在 CARD_SELECTOR 里，
      // 关闭分区开关时需要靠这份记录把它们恢复原状
      if (!card.matches || !card.matches(CARD_SELECTOR)) trackedCards.add(card);
      if (card.dataset.bfState === 'blocked') continue;   // 已屏蔽，跳过
      processCard(card);
      handled++;
    }
  }

  /** 板块级屏蔽：整行 / 整个推广位（含顶部轮播横幅） */
  function applySectionBlocks() {
    var marked = document.querySelectorAll('.bf-section-blocked');
    for (var i = 0; i < marked.length; i++) marked[i].classList.remove('bf-section-blocked');

    if (!settings.enabled) return;
    var enabled = TYPES.filter(function (t) { return settings.blockSections[t.key]; });
    if (!enabled.length) return;

    var anchors = document.querySelectorAll('a[href]');
    var roots = [];
    for (var k = 0; k < anchors.length && roots.length < 40; k++) {
      var a = anchors[k];
      if (isExcludedAnchor(a)) continue;
      var href = a.getAttribute('href') || '';
      var hit = null;
      for (var j = 0; j < enabled.length; j++) {
        if (enabled[j].href.test(href)) { hit = enabled[j]; break; }
      }
      if (!hit) continue;

      var root = findSectionRoot(a, hit);
      if (!root || roots.indexOf(root) !== -1) continue;
      roots.push(root);
      var els = sectionElements(root);
      for (var m = 0; m < els.length; m++) els[m].classList.add('bf-section-blocked');
      log('已屏蔽板块：', hit.key, root.className);
    }
  }

  function scanAll(force) {
    fullScan(force);
    scanTypedCards();

    // 设置变更时，把通用识别找到过的卡片也重新判定一遍（否则关掉开关后无法恢复）
    if (force && trackedCards.size) {
      trackedCards.forEach(function (card) {
        if (!card.isConnected) { trackedCards.delete(card); return; }
        if (!card.matches || !card.matches(CARD_SELECTOR)) processCard(card);
      });
    }

    var now = Date.now();
    if (force || now - lastSectionScanAt > 800) {
      lastSectionScanAt = now;
      applySectionBlocks();
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
  }

  function scheduleFlush() {
    if (flushTimer) return;
    flushTimer = setTimeout(flush, 180);
  }

  function markDirty(node) {
    if (!node || node.nodeType !== 1) return;
    if (node.classList && (node.classList.contains('bf-mask') || node.classList.contains('bf-section-blocked'))) return;
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
    '        <div class="bf-label"><span>屏蔽分区推广（卡片）</span></div>',
    '        <div class="bf-types" id="bf-types"></div>',
    '        <div class="bf-subrow">',
    '          <span>整行板块也一起屏蔽</span>',
    '          <button class="bf-switch bf-switch--sm" id="bf-sections" type="button" role="switch"></button>',
    '        </div>',
    '        <div class="bf-hint" id="bf-sections-hint">开启后，已勾选分区所在的整行推广板块（含顶部轮播横幅）会一并隐藏</div>',
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

    shadow.getElementById('bf-types').addEventListener('click', function (e) {
      var el = e.target.closest('.bf-type');
      if (!el) return;
      var key = el.dataset.key;
      var next = Object.assign({}, settings.blockTypes);
      next[key] = !next[key];
      updateSettings({ blockTypes: next });
    });

    // 整行板块：只作用于"已勾选卡片级"的分区，避免在没有选择任何分区时误伤整页
    shadow.getElementById('bf-sections').addEventListener('click', function () {
      var enabledKeys = TYPES.filter(function (t) { return settings.blockTypes[t.key]; })
                             .map(function (t) { return t.key; });
      if (!enabledKeys.length) {
        flashSectionHint('请先在上方勾选至少一个分区');
        return;
      }
      var on = !allSectionsOn();
      var next = Object.assign({}, settings.blockSections);
      enabledKeys.forEach(function (k) { next[k] = on; });
      updateSettings({ blockSections: next });
      flashSectionHint(on
        ? '已连同整行推广板块一起屏蔽'
        : '已恢复显示整行推广板块');
    });

    shadow.getElementById('bf-reset-pos').addEventListener('click', resetButtonPos);

    shadow.getElementById('bf-open-options').addEventListener('click', function () {
      try {
        chrome.runtime.sendMessage({ type: 'BF_OPEN_OPTIONS' }, function () { void chrome.runtime.lastError; });
      } catch (err) { /* ignore */ }
      togglePanel(false);
    });
  }

  /** 整行板块开关是否处于"开"：只看已勾选卡片级的分区 */
  function allSectionsOn() {
    var any = false;
    for (var i = 0; i < TYPES.length; i++) {
      var k = TYPES[i].key;
      if (!settings.blockTypes[k]) continue;
      any = true;
      if (!settings.blockSections[k]) return false;
    }
    return any;
  }

  var sectionHintTimer = null;
  function flashSectionHint(text) {
    if (!shadow) return;
    var el = shadow.getElementById('bf-sections-hint');
    if (!el) return;
    el.textContent = text;
    el.classList.add('is-warn');
    clearTimeout(sectionHintTimer);
    sectionHintTimer = setTimeout(function () {
      el.classList.remove('is-warn');
      el.textContent = '开启后，已勾选分区所在的整行推广板块（含顶部轮播横幅）会一并隐藏';
    }, 2600);
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
        : '直接从页面移除，如同从未出现';

    shadow.querySelectorAll('#bf-theme button').forEach(function (b) {
      b.classList.toggle('is-active', b.dataset.value === settings.theme);
    });

    var chips = shadow.getElementById('bf-chips');
    chips.innerHTML = '';
    if (!settings.keywords.length) {
      var empty = document.createElement('div');
      empty.className = 'bf-empty';
      empty.textContent = '还没有屏蔽词，添加后立即生效';
      chips.appendChild(empty);
    } else {
      settings.keywords.forEach(function (kw, i) {
        var chip = document.createElement('span');
        chip.className = 'bf-chip';
        var t = document.createElement('span');
        t.className = 'bf-chip__text';
        t.textContent = kw;
        t.title = kw;
        var del = document.createElement('button');
        del.className = 'bf-chip__del';
        del.type = 'button';
        del.dataset.index = String(i);
        del.textContent = '✕';
        del.title = '删除';
        chip.appendChild(t);
        chip.appendChild(del);
        chips.appendChild(chip);
      });
    }

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

    var sectionsBtn = shadow.getElementById('bf-sections');
    sectionsBtn.classList.toggle('is-on', allSectionsOn());
    sectionsBtn.setAttribute('aria-checked', allSectionsOn() ? 'true' : 'false');

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
