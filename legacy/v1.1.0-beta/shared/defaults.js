/**
 * 共享的默认配置与分区类型定义。
 * 会被 content script、popup、options、background 同时加载。
 * 通过全局对象暴露（避免使用 ES module，兼容 MV3 各类上下文）。
 */
(function (root) {
  'use strict';

  /**
   * 可屏蔽的"分区推广"类型。
   * href   : 命中卡片内任意链接时判定为该类型（通用识别，不依赖 class）
   * cls    : 卡片 class 兜底判定（使用 2025 年实测到的 B 站真实类名）
   * block  : 语义板块容器选择器（板块级屏蔽时向上寻找的落点）
   */
  var BF_TYPES = [
    {
      key: 'live',
      label: '直播',
      desc: '首页 / 分区里的直播卡片与直播推广位',
      href: /(^|\/\/)live\.bilibili\.com|\/blanc\/|\/live\//,
      cls: /\bbili-live-card\b|\blive-card\b|\bis-live\b|\bcarousel-inner__live\b/i,
      block: '.floor-card, .floor-single-card, [class*="live-floor"], [class*="floor-"]'
    },
    {
      key: 'bangumi',
      label: '番剧',
      desc: '番剧、动画剧集卡片（含顶部轮播与追番推广位）',
      href: /\/bangumi\/(play|media)\//,
      cls: /\bbili-bangumi-card\b|\bbangumi-card\b|\bpgc-card\b|\banime-list-item\b|\banime-entry\b/i,
      block: '.carousel-area, .carousel-container, .anime-list, .floor-card, [class*="floor-"]'
    },
    {
      key: 'movie',
      label: '影视',
      desc: '电影、电视剧、纪录片等影视卡片',
      href: /\/movie\/|\/film\/|bilibili\.com\/bangumi\/media\/md/,
      cls: /\bbili-movie-card\b|\bmovie-card\b|\bbili-cinema-card\b/i,
      block: '.floor-card, [class*="floor-"]'
    },
    {
      key: 'cheese',
      label: '课堂 / 课程',
      desc: '付费课程、课堂推广卡片',
      href: /\/cheese\/play\//,
      cls: /\bbili-cheese-card\b|\bcheese-card\b/i,
      block: '.floor-card, [class*="floor-"]'
    },
    {
      key: 'read',
      label: '专栏 / 图文',
      desc: '专栏文章、图文类卡片',
      href: /\/read\/(cv|cv\d)|\/read\/mobile|\/read\/home/,
      cls: /\bbili-article-card\b|\barticle-card\b/i,
      block: '.floor-card, [class*="floor-"]'
    },
    {
      key: 'opus',
      label: '动态 / 视频号',
      desc: '动态、UP 主动态推广卡片',
      href: /\/opus\/|(^|\/\/)t\.bilibili\.com/,
      cls: /\bbili-dyn-card\b|\bbili-opus-card\b|\bdyn-card\b/i,
      block: '.floor-card, [class*="floor-"]'
    },
    {
      key: 'manga',
      label: '漫画',
      desc: '漫画、漫画推广卡片',
      href: /\/manga\//,
      cls: /\bbili-manga-card\b|\bmanga-card\b/i,
      block: '.floor-card, [class*="floor-"]'
    },
    {
      key: 'activity',
      label: '活动 / 话题推广位',
      desc: '活动页、话题页、专题聚合推广卡片',
      href: /\/blackboard\/|\/festival\/|\/topic\/|\/match\//,
      cls: /\bbili-activity-card\b|\bactivity-card\b/i,
      block: '.floor-card, .floor-single-card, [class*="floor-"], [class*="banner"]'
    },
    {
      key: 'ad',
      label: '商业广告',
      desc: '带"广告"标识的推广卡片',
      href: /(^|\/\/)(cm|ad)\.bilibili\.com|[?&]from_spmid=.*ad/,
      cls: /\bad-card\b|\bad-item\b|\badvert|\bbili-video-card__stats--ad\b|\bad-report\b/i,
      block: '.floor-card, [class*="ad-"], [class*="banner"]'
    }
  ];

  var BF_DEFAULTS = {
    /** 总开关 */
    enabled: true,

    /** 屏蔽方式：mask = 标题+封面合成一块提示区域；hide = 直接从页面移除 */
    mode: 'mask',

    /** 遮蔽区域显示的文案 */
    maskText: '根据您的屏蔽词已将此视频屏蔽',

    /** 分区推广屏蔽时显示的文案，{type} 会被替换为分区名 */
    typeMaskText: '已按分区设置屏蔽此推广：{type}',

    /** 标题屏蔽词列表 */
    keywords: [],

    /** 匹配选项 */
    useRegex: false,
    caseSensitive: false,
    /** 是否同时匹配 UP 主名称 */
    matchUpName: false,

    /** 分区推广屏蔽：卡片级（该分区的每一张卡片） */
    blockTypes: {
      live: false,
      bangumi: false,
      movie: false,
      cheese: false,
      read: false,
      opus: false,
      manga: false,
      activity: false,
      ad: false
    },

    /** 分区推广屏蔽：板块级（该分区所在的整行 / 整个推广位） */
    blockSections: {
      live: false,
      bangumi: false,
      movie: false,
      cheese: false,
      read: false,
      opus: false,
      manga: false,
      activity: false,
      ad: false
    },

    /** 注入界面的外观：auto = 跟随 B 站深色模式 */
    theme: 'auto',

    /** 鼠标悬停在遮蔽区域时自动展示该视频 */
    revealOnHover: true,

    /** 是否在 B 站标题栏附近显示快捷面板入口 */
    showHeaderButton: true,

    /** 悬浮按钮自定义位置（视口坐标，null = 自动停靠在标题栏右侧） */
    buttonPos: null,

    /** 是否在控制台输出调试日志 */
    debug: false
  };

  /** 深拷贝默认值，避免各上下文互相污染 */
  function bfCloneDefaults() {
    return JSON.parse(JSON.stringify(BF_DEFAULTS));
  }

  function normalizeBoolMap(raw, out) {
    if (raw && typeof raw === 'object') {
      BF_TYPES.forEach(function (t) {
        out[t.key] = !!raw[t.key];
      });
    }
  }

  /** 把任意（可能残缺的）配置规范化成完整配置 */
  function bfNormalize(raw) {
    var out = bfCloneDefaults();
    if (!raw || typeof raw !== 'object') return out;

    Object.keys(BF_DEFAULTS).forEach(function (k) {
      var def = BF_DEFAULTS[k];
      var val = raw[k];

      // 缺失的键一律沿用默认值（否则布尔项会被 !!undefined 重置为 false）
      if (!(k in raw)) return;

      if (k === 'blockTypes') {
        normalizeBoolMap(val, out.blockTypes);
        return;
      }
      if (k === 'blockSections') {
        normalizeBoolMap(val, out.blockSections);
        return;
      }
      if (k === 'revealOnHover') {
        // 兼容 1.0.x 的 clickToReveal 设置
        if ('revealOnHover' in raw) out.revealOnHover = !!raw.revealOnHover;
        else if ('clickToReveal' in raw) out.revealOnHover = !!raw.clickToReveal;
        return;
      }
      if (k === 'buttonPos') {
        if (val && typeof val === 'object' && isFinite(val.left) && isFinite(val.top)) {
          out.buttonPos = { left: Number(val.left), top: Number(val.top) };
        } else {
          out.buttonPos = null;
        }
        return;
      }
      if (k === 'keywords') {
        out.keywords = Array.isArray(val)
          ? val.map(function (s) { return String(s == null ? '' : s); })
              .map(function (s) { return s.trim(); })
              .filter(function (s) { return s.length > 0; })
          : [];
        return;
      }
      if (typeof def === 'boolean') out[k] = !!val;
      else if (typeof def === 'string') out[k] = typeof val === 'string' ? val : def;
      else out[k] = val;
    });
    return out;
  }

  var api = {
    BF_DEFAULTS: BF_DEFAULTS,
    BF_TYPES: BF_TYPES,
    bfCloneDefaults: bfCloneDefaults,
    bfNormalize: bfNormalize
  };

  root.BF_DEFAULTS = BF_DEFAULTS;
  root.BF_TYPES = BF_TYPES;
  root.bfCloneDefaults = bfCloneDefaults;
  root.bfNormalize = bfNormalize;

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof self !== 'undefined' ? self : this);
