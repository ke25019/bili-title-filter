/**
 * 共享的默认配置与分区类型定义。
 * 会被 content script、popup、options、background 同时加载。
 * 通过全局对象暴露（避免使用 ES module，兼容 MV3 各类上下文）。
 */
(function (root) {
  'use strict';

  /**
   * 可屏蔽的"分区推广"类型。
   * href: 命中卡片内任意链接时判定为该类型
   * cls : 卡片 class / 属性兜底判定
   */
  var BF_TYPES = [
    {
      key: 'live',
      label: '直播',
      desc: '首页 / 分区里的直播卡片与直播推广位',
      href: /(^|\/\/)live\.bilibili\.com|\/live\//,
      cls: /\blive-card\b|\bbili-live-card\b|\bis-live\b/i
    },
    {
      key: 'bangumi',
      label: '番剧',
      desc: '番剧、动画剧集卡片（含追番推广位）',
      href: /\/bangumi\/(play|media)\//,
      cls: /\bbili-bangumi-card\b|\bbangumi-card\b|\bpgc-card\b/i
    },
    {
      key: 'movie',
      label: '影视',
      desc: '电影、电视剧、纪录片等影视卡片',
      href: /\/movie\/|\/film\/|bilibili\.com\/bangumi\/media\/md/,
      cls: /\bbili-movie-card\b|\bmovie-card\b|\bbili-cinema-card\b/i
    },
    {
      key: 'cheese',
      label: '课堂 / 课程',
      desc: '付费课程、课堂推广卡片',
      href: /\/cheese\/play\//,
      cls: /\bbili-cheese-card\b|\bcheese-card\b/i
    },
    {
      key: 'read',
      label: '专栏 / 图文',
      desc: '专栏文章、图文类卡片',
      href: /\/read\/(cv|cv\d)|\/read\/mobile/,
      cls: /\bbili-article-card\b|\barticle-card\b/i
    },
    {
      key: 'opus',
      label: '动态 / 视频号',
      desc: '动态、UP 主动态推广卡片',
      href: /\/opus\/|(^|\/\/)t\.bilibili\.com/,
      cls: /\bbili-dyn-card\b|\bbili-opus-card\b|\bdyn-card\b/i
    },
    {
      key: 'manga',
      label: '漫画',
      desc: '漫画、漫画推广卡片',
      href: /\/manga\//,
      cls: /\bbili-manga-card\b|\bmanga-card\b/i
    },
    {
      key: 'activity',
      label: '活动 / 话题推广位',
      desc: '活动页、话题页、专题聚合推广卡片',
      href: /\/blackboard\/|\/festival\/|\/topic\/|\/match\//,
      cls: /\bbili-activity-card\b|\bactivity-card\b/i
    },
    {
      key: 'ad',
      label: '商业广告',
      desc: '带"广告"标识的推广卡片',
      href: /(^|\/\/)(cm|ad)\.bilibili\.com|[?&]from_spmid=.*ad/,
      cls: /\bad-card\b|\bad-item\b|\badvert|\bbili-video-card__stats--ad\b|\bad-report\b/i
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

    /** 分区推广屏蔽开关 */
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

    /** 注入界面的外观：auto = 跟随 B 站深色模式 */
    theme: 'auto',

    /** 点击遮蔽区域可临时查看该视频 */
    clickToReveal: true,

    /** 是否在 B 站标题栏附近显示快捷面板入口 */
    showHeaderButton: true,

    /** 是否在控制台输出调试日志 */
    debug: false
  };

  /** 深拷贝默认值，避免各上下文互相污染 */
  function bfCloneDefaults() {
    return JSON.parse(JSON.stringify(BF_DEFAULTS));
  }

  /** 把任意（可能残缺的）配置规范化成完整配置 */
  function bfNormalize(raw) {
    var out = bfCloneDefaults();
    if (!raw || typeof raw !== 'object') return out;

    Object.keys(BF_DEFAULTS).forEach(function (k) {
      if (!(k in raw)) return;
      var def = BF_DEFAULTS[k];
      var val = raw[k];
      if (k === 'blockTypes') {
        if (val && typeof val === 'object') {
          BF_TYPES.forEach(function (t) {
            out.blockTypes[t.key] = !!val[t.key];
          });
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
