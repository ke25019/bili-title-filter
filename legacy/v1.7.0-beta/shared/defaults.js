/**
 * 共享的默认配置与分区类型定义。
 * 会被 content script、popup、options、background 同时加载。
 * 通过全局对象暴露（避免使用 ES module，兼容 MV3 各类上下文）。
 */
(function (root) {
  'use strict';

  /**
   * 可屏蔽的"分区推广"类型（按实测的 B 站首页真实域名 / 路径整理）。
   *
   * label : 面板 / 弹窗里的短标签（≤4 字，保证网格对齐）
   * desc  : 设置页里的说明文字
   * href  : 命中卡片内任意链接时判定为该类型
   * cls   : 卡片 class 兜底判定
   *
   * 注意：other 必须放在最后，它只在该卡片没有命中任何其它类型时才生效，
   *       因此"关掉直播 + 打开其他推广"不会把直播卡片一起带走。
   */
  var BF_TYPES = [
    {
      key: 'live',
      label: '直播',
      badge: '直播',
      desc: '直播卡片与直播推广位（live.bilibili.com）',
      href: /(^|\/\/)live\.bilibili\.com|\/blanc\/|\/live\//,
      cls: /\bbili-live-card\b|\blive-card\b|\bis-live\b|\bcarousel-inner__live\b/i
    },
    {
      key: 'bangumi',
      label: '番剧',
      badge: '番剧',
      desc: '番剧卡片（/bangumi/、/anime/）',
      href: /\/bangumi\/(play|media)\/|\/anime\//,
      cls: /\bbili-bangumi-card\b|\bbangumi-card\b|\bpgc-card\b|\banime-list-item\b|\banime-entry\b/i
    },
    {
      key: 'guochuang',
      label: '国创',
      badge: '国创',
      desc: '国创动画卡片（/guochuang/；推广位上的链接和番剧一样是 /bangumi/，靠封面徽标区分）',
      href: /\/guochuang\//,
      cls: ''
    },
    {
      key: 'movie',
      label: '电影',
      badge: '电影',
      desc: '电影、影视卡片（/movie/、/film/）',
      href: /\/movie\/|\/film\/|bangumi\/media\/md/,
      cls: /\bbili-movie-card\b|\bmovie-card\b|\bbili-cinema-card\b/i
    },
    {
      key: 'tv',
      label: '电视剧',
      badge: '电视剧',
      desc: '电视剧卡片（/tv/；推广位上的链接同样可能是 /bangumi/，靠封面徽标区分）',
      href: /\/tv\//,
      cls: ''
    },
    {
      key: 'documentary',
      label: '纪录片',
      badge: '纪录片',
      desc: '纪录片卡片（/documentary/；推广位上的链接同样可能是 /bangumi/，靠封面徽标区分）',
      href: /\/documentary\//,
      cls: ''
    },
    {
      key: 'variety',
      label: '综艺',
      badge: '综艺',
      desc: '综艺卡片（/variety/；推广位上的链接同样可能是 /bangumi/，靠封面徽标区分）',
      href: /\/variety\//,
      cls: ''
    },
    {
      key: 'cheese',
      label: '课堂',
      badge: '课堂',
      desc: '付费课程、课堂推广卡片（/cheese/）',
      href: /\/cheese\//,
      cls: /\bbili-cheese-card\b|\bcheese-card\b/i
    },
    {
      key: 'read',
      label: '专栏',
      badge: '专栏',
      desc: '专栏文章、图文类卡片（/read/）',
      href: /\/read\//,
      cls: /\bbili-article-card\b|\barticle-card\b/i
    },
    {
      key: 'opus',
      label: '动态',
      badge: '动态',
      desc: '动态、视频号推广卡片（/opus/、t.bilibili.com）',
      href: /\/opus\/|(^|\/\/)t\.bilibili\.com/,
      cls: /\bbili-dyn-card\b|\bbili-opus-card\b|\bdyn-card\b/i
    },
    {
      key: 'manga',
      label: '漫画',
      badge: '漫画',
      desc: '漫画卡片与漫画推广位（manga.bilibili.com）',
      href: /\/\/manga\.bilibili\.com|\/manga\//,
      cls: /\bbili-manga-card\b|\bmanga-card\b/i
    },
    {
      key: 'game',
      label: '游戏',
      badge: '游戏',
      desc: '游戏中心、游戏推广与专区卡片（game.bilibili.com、/v/game）',
      href: /\/\/game\.bilibili\.com|\/v\/game|\/game\//,
      cls: /\bbili-game-card\b|\bgame-card\b/i
    },
    {
      key: 'music',
      label: '音乐',
      badge: '音乐',
      desc: '音频、音乐区推广卡片（music.bilibili.com、/audio/）',
      href: /\/\/music\.bilibili\.com|\/audio\//,
      cls: /\bbili-audio-card\b|\baudio-card\b/i
    },
    {
      key: 'match',
      label: '赛事',
      badge: '赛事',
      desc: '赛事、电竞赛程与直播预约推广（/match/、/esports/）',
      href: /\/match\/|\/\/match\.bilibili\.com|\/esports\//,
      cls: /\bmatch-card\b|\besports-card\b/i
    },
    {
      key: 'mall',
      label: '会员购',
      badge: '会员购',
      desc: '会员购、周边商城与演出票务推广（love / show / mall.bilibili.com）',
      href: /\/\/(love|show|mall)\.bilibili\.com|\/mall\//,
      cls: /\bmall-card\b|\bshop-card\b/i
    },
    {
      key: 'activity',
      label: '活动',
      badge: '活动',
      desc: '活动页、话题页、专题聚合推广位（/blackboard/、/festival/、/topic/）',
      href: /\/blackboard\/|\/festival\/|\/topic\/|\/platform\//,
      cls: /\bbili-activity-card\b|\bactivity-card\b/i
    },
    {
      key: 'ad',
      label: '广告',
      badge: '广告',
      desc: '带"广告"标识的商业推广卡片',
      href: /(^|\/\/)(cm|ad)\.bilibili\.com|[?&]from_spmid=.*ad/,
      cls: /\bad-card\b|\bad-item\b|\badvert|\bbili-video-card__stats--ad\b|\bad-report\b/i
    },
    {
      key: 'other',
      label: '其他推广',
      badge: '',
      desc: '兜底：跳往站内其它频道、客户端下载或站外链接的推广卡片（不含上面已分类的分区）',
      href: /\/\/(?!www|space|passport|i0|i1|i2|s1|s2|static|api|grpc)[a-z0-9-]+\.bilibili\.com|\/blackboard\/|\/festival\/|\/topic\/|\/platform\/|\/read\/|\/cheese\/|\/anime\/|\/guochuang\/|\/variety\/|\/documentary\/|\/movie\/|\/tv\/|\/bangumi\/|\/audio\/|\/manga\/|\/v\/[a-z]/i,
      cls: ''
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

    /**
     * UP 白名单：名单里的 UP 永远不会被屏蔽（关键词和分区开关都不作用于它）
     * 每一项填 UP 名字，要和卡片上显示的完全一致（忽略大小写）
     */
    whitelist: [],

    /** 匹配选项 */
    useRegex: false,
    caseSensitive: false,
    /** 是否同时匹配 UP 主名称 */
    matchUpName: false,

    /**
     * 分区推广屏蔽：卡片级（该分区的每一张卡片）
     * 注意：1.3.0 起「影视」拆成了 电影 / 电视剧 / 纪录片 / 综艺，「番剧」也不再连带国创。
     * 老配置里只开过 movie 的，升级后只有「电影」是开的，其余几类需要单独打开。
     */
    blockTypes: {
      live: false, bangumi: false, guochuang: false, movie: false, tv: false,
      documentary: false, variety: false, cheese: false, read: false, opus: false,
      manga: false, game: false, music: false, match: false, mall: false,
      activity: false, ad: false, other: false
    },

    /**
     * 完全隐藏时是否保留原来的位置（默认开启，与 v1.0.0-beta 的行为一致）：
     *   true  = 只隐藏卡片内容，位置留空 → 页面不重排、不变短，
     *           也不会把 B 站末尾的空骨架占位块"顶"到内容中间（更稳定）
     *   false = 把卡片整个从布局里移除 → 后面的内容前移补位（页面会变短，
     *           并配合"空占位块收敛"避免灰色空块）
     */
    hideKeepSlot: true,

    /**
     * 屏蔽首页顶部的大轮播横幅（独立开关，只作用于首页那一块）。
     * 注意：这个开关一打开就是整块完全隐藏，不跟随「整体遮蔽 / 完全隐藏」的屏蔽方式；
     * 首页最上方的头部横幅图（.bili-header__banner）不在屏蔽范围内。
     */
    blockBanner: false,

    /**
     * 播放器页面屏蔽（独立开关，**默认开启**）。
     * 目前覆盖播放页播放器下方的横幅广告位（实测 #slide_ad.slide-ad-exp）。
     * 与「广告」分区开关相互独立：那个管卡片，这个管播放器页面上的广告位。
     * 实现上只按 ID / 专属类名命中广告位本体，**绝不**像 1.5.1~1.5.8 那样往上收
     * 「整卡外壳」—— 因此不会碰到播放器、弹幕面板（#danmukuBox）与顶栏。
     */
    blockPlayerAd: true,

    /** 注入界面的外观：auto = 跟随 B 站深色模式 */
    theme: 'auto',

    /** 鼠标悬停在遮蔽区域时自动展示该视频 */
    revealOnHover: true,

    /** 是否在 B 站标题栏附近显示快捷面板入口 */
    showHeaderButton: true,

    /**
     * 页面级开关：在这些页面上要不要屏蔽。
     *   站内搜索结果页（search.bilibili.com）：默认开
     *   UP 个人主页（space.bilibili.com）：默认关 —— 主页上大多是 UP 自己的作品，
     *   顺手把整页按关键词筛一遍容易误伤，所以默认不动它
     * 另外登录页（passport.bilibili.com 或路径里带 login）一律不屏蔽，不受这两个开关影响。
     */
    blockOnSearch: true,
    blockOnSpace: false,

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
      var def = BF_DEFAULTS[k];
      var val = raw[k];

      // 缺失的键一律沿用默认值（否则布尔项会被 !!undefined 重置为 false）
      if (!(k in raw)) return;

      if (k === 'blockTypes') {
        if (val && typeof val === 'object') {
          BF_TYPES.forEach(function (t) { out.blockTypes[t.key] = !!val[t.key]; });
        }
        return;
      }
      if (k === 'revealOnHover') {
        // 兼容 1.0.x 的 clickToReveal 设置
        if ('revealOnHover' in raw) out.revealOnHover = !!raw.revealOnHover;
        else if ('clickToReveal' in raw) out.revealOnHover = !!raw.clickToReveal;
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
      if (k === 'whitelist') {
        // 白名单：去掉空白项与重复项（同一项只留一个）
        out.whitelist = Array.isArray(val)
          ? val.map(function (s) { return String(s == null ? '' : s); })
              .map(function (s) { return s.trim(); })
              .filter(function (s, i, arr) { return s.length > 0 && arr.indexOf(s) === i; })
          : [];
        return;
      }
      if (typeof def === 'boolean') out[k] = !!val;
      else if (typeof def === 'string') out[k] = typeof val === 'string' ? val : def;
      else out[k] = val;
    });

    // 1.1.3 及更早版本遗留的"整行板块"配置：功能已移除，这里直接丢弃，
    // 但如果有任何一个分区开过整行屏蔽，就把新的"顶部轮播横幅"开关打开作为替代。
    if (raw.blockSections && typeof raw.blockSections === 'object') {
      var anySection = BF_TYPES.some(function (t) { return !!raw.blockSections[t.key]; });
      if (anySection && !('blockBanner' in raw)) out.blockBanner = true;
    }

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
