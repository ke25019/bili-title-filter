# 验证脚本

这些脚本用 [jsdom](https://github.com/jsdom/jsdom) 模拟 B 站页面与浏览器扩展 API，用来验证扩展的核心行为。
**它们只用于开发自测，不参与扩展运行，也不是加载扩展所必需的。**

## 运行

```bash
cd tests
npm install          # 安装 jsdom
npm test             # 运行全部验证
```

或单独运行：

```bash
node test-content.js      # 内容脚本：屏蔽逻辑、分区识别、悬停展示、面板拖动、深色模式
node test-ui.js           # 扩展弹窗与完整设置页的交互
node test-background.js   # 后台 Service Worker：统计、徽标、默认配置
```

## 真实浏览器调试（`browser-harness/`）

有些问题（B 站真实 DOM 结构、布局回流、占位块被顶上来等）jsdom 测不出来，需要把扩展装进真实浏览器实测。
`browser-harness/` 提供这套流程，**第一原则是绝不能影响使用者日常使用的浏览器**：

```powershell
cd browser-harness
.\safe-edge.ps1 -Action start -ExtensionPath "H:\path\to\bili-title-filter"   # 启动独立无头实例
node probe.js <表达式文件>     # 取页面数据
node shot.js out.png [full]   # 截图（full = 整页；用完 node shot.js x.png reset 还原视口）
.\safe-edge.ps1 -Action stop  # 只关自己的实例
```

安全规则（详见 `browser-harness/README.md`）：

1. **绝不按进程名杀进程**——`Stop-Process -Name msedge` 会连带杀掉使用者正在用的所有 Edge 窗口；
   这里只结束命令行里带专属 profile `%TEMP%\bf-test-edge` 的进程
2. 独立 `--user-data-dir` + 独立调试端口（9223），与默认 profile 完全隔离
3. **必须带 `--disable-sync`**——否则使用者的扩展配置会被同步进测试实例，测试里的改动也可能同步回其账号
4. `probe.js` / `shot.js` 只在 `.test-instance.json` 标记文件存在时才连接，避免误连到使用者的浏览器

---

## 覆盖内容

| 脚本 | 校验点 |
| --- | --- |
| `test-content.js` | 199 项：面板挂载/Shadow DOM 隔离、关键词命中、**整体遮蔽** 文案与结构、**鼠标悬停自动展示**、**完全隐藏**、**真实直播楼层结构下的分区卡片级遮蔽（封面+标题只生成一个遮罩）**、**「其他推广」兜底**、**首页顶部轮播横幅独立开关**、**页面级开关（登录页一律不屏蔽、搜索页默认开、UP 主页默认关）**、**播放页广告：播放器贴片广告与右栏广告卡片（`.video-card-ad-small`）判为「广告」而不是被「活动」抢走、嵌套的 `.ad-report-link` 不重复遮蔽、UP 主信息块不被当成卡片（v1.5.1 回归点）**、**右栏广告卡的「整卡外壳」：标题/UP 名挂在广告位外面时要一起遮、广告与真实卡片同处一个列表时不越过列表容器、播放器那层 1130×640 容器绝不被收进来（v1.5.2 回归点）**、**播放器活动横幅（`.inside-wrp`）：必须同时有图片块与文案行才认、整块一起遮、同名类名容器不误伤（v1.5.2 回归点）**、**UP 白名单按包含匹配（关键词只写一半 UP 名也不能绕过白名单）、站内搜索结果页的真实卡片结构（v1.3.3 回归点）**、**顶部轮播横幅：开关一开就整块隐藏（不跟随屏蔽方式）、连占着的网格项一起收、且不碰头部横幅图（v1.3.3 回归点）**、**完全隐藏模式下空占位块的收敛与自动恢复（v1.1.5 回归点）**、**完全隐藏模式下空占位项的收敛与自动恢复（v1.1.5 回归点）**、**顶栏导航与隐藏推广位不被误伤**、**安全阀：1401×808 超大容器与 0×0 隐藏元素绝不被遮蔽（v1.1.3 页面空白回归点）**、**按浏览器算出来的 display/visibility 复核外层容器是否真的被隐藏、分区徽标不当标题、带「直播中」角标的直播卡片（v1.2.0 回归点）**、解除屏蔽、正则与大小写、UP 主匹配、MutationObserver 捕获滚动新增卡片、**悬浮按钮拖动与位置记忆/重置**、总开关、深色模式识别 |
| `test-ui.js` | 89 项：弹窗与设置页的渲染、屏蔽词增删与批量去重、模式/主题/正则开关保存、**扩展包本地化配置（_locales + default_locale + __MSG_ 占位，v1.4.0 回归点）**、**18 行分区表格与单分区开关**、**轮播横幅开关（弹窗 + 设置页）**、**悬停展示开关**、预览同步、重置悬浮按钮位置、恢复默认 |
| `test-background.js` | 22 项：默认配置写入、18 类分区开关默认值、轮播横幅默认关闭、旧「整行板块」配置项已移除、屏蔽计数累加、徽标数字与颜色、`999+` 截断、统计查询与重置、安装事件补齐默认值 |

合计 **310 项**。

> 注意 1：浏览器里 `DOMContentLoaded` 只会触发一次；如果你的测试里手动派发该事件，会让监听器重复绑定，
> 从而出现「开关点了没反应」的假象。页面脚本已改用 `ready()` 助手（`readyState !== 'loading'` 时立即执行），
> 测试中无需手动派发。
>
> 注意 2：内容脚本测试用的模拟 DOM 结构**全部来自真实浏览器 CDP 实测**（Edge 152 无头实例加载扩展后抓取）：
> `.feed-list > .feed-card > .bili-feed-card > .bili-video-card`、
> 直播推广楼层 `.floor-card-inner > .cover-container + .pb-16.px-12 > p.title`、
> 顶部轮播 `.vui_carousel > .vui_carousel__slides > .carousel-area`、
> 隐藏推广位 `.palette-button-inner`（0×0 反馈链接）、顶栏 `.channel-link__right` 导航入口、
> 播放页广告位（结构照抄自使用者反馈截图里的 DOM 树与 Copy outerHTML）：
> `#slide_ad.slide-ad-exp > .slide-ad > .van-slide-item-box > .item > .ad-report-link > a.ad-report-inner`、
> `.video-card-ad-small > .ad-report-inner > a.ad-report > .ad-floor-cover-img`、UP 主信息块 `.up-info-container`、
> 播放器活动横幅 `.inside-wrp > .left > .l-inside > .hinter-msg` + `.right > .inside-bg.clickable > .b-img > img`。
> 右栏广告卡的"整卡外壳"用的是自造的 `.ad-card-wrapper`（真实类名未知，正是这样才要按结构往上收）。
>
> 注意 3：jsdom 没有排版引擎，`getBoundingClientRect()` 恒为 0。因此测试里用 `data-w` / `data-h`
> **模拟真实尺寸**（并把 `document.body` 留成 0，让内容脚本判定为"无排版环境"），
> 这样「尺寸超过 1200×800 / 视口 35% 就放弃遮蔽」这条安全阀也能被真实校验。
