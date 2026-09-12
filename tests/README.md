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
node test-content.js      # 内容脚本：屏蔽逻辑、分区识别、面板挂载、深色模式
node test-ui.js           # 扩展弹窗与完整设置页的交互
node test-background.js   # 后台 Service Worker：统计、徽标、默认配置
```

## 覆盖内容

| 脚本 | 校验点 |
| --- | --- |
| `test-content.js` | 38 项：面板挂载/Shadow DOM 隔离、关键词命中、**整体遮蔽** 文案与结构、**完全隐藏**、切换屏蔽方式、直播/番剧分区识别与屏蔽、解除屏蔽、正则与大小写、UP 主匹配、MutationObserver 捕获滚动新增卡片、总开关、深色模式识别 |
| `test-ui.js` | 29 项：弹窗与设置页的渲染、屏蔽词增删与批量去重、模式/主题/分区/正则开关保存、预览同步、恢复默认 |
| `test-background.js` | 18 项：默认配置写入、屏蔽计数累加、徽标数字与颜色、`999+` 截断、统计查询与重置、安装事件补齐默认值 |

> 注意：浏览器里 `DOMContentLoaded` 只会触发一次；如果你的测试里手动派发该事件，会让监听器重复绑定，
> 从而出现「开关点了没反应」的假象。页面脚本已改用 `ready()` 助手（`readyState !== 'loading'` 时立即执行），
> 测试中无需手动派发。
