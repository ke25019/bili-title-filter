# 旧版本归档 / Archived versions

这里保存历史版本的**完整源码快照**，每个子目录都是一个**可以直接加载的独立扩展**
（Edge：`edge://extensions/` → 开发人员模式 → 加载解压缩的扩展 → 选择对应子目录）。

| 目录 | 版本 | 标签 | 说明 |
| --- | --- | --- | --- |
| `v1.0.0-beta/` | v1.0.0-beta.1 | `v1.0.0-beta.1` | 首个公开测试版：标题屏蔽词、两种屏蔽方式、9 类分区推广、页面内悬浮面板、深色模式 |
| `v1.1.0-beta/` | v1.1.0-beta | `v1.1.0-beta` | 分区通用识别、悬停自动展示、可拖动悬浮按钮（**注意：该版本存在"分区识别误遮蔽整页"的缺陷**） |
| `v1.1.3-beta/` | v1.1.3-beta | `v1.1.3-beta` | 补全 14 类分区与「其他推广」兜底、新增「整行板块」功能（**注意：该版本的整行板块与过大容器识别存在缺陷，已在 v1.1.4 移除/修复**） |
| `v1.1.4-beta/` | v1.1.4-beta | `v1.1.4-beta` | 移除整行板块、改为独立轮播横幅开关、重写分区卡片识别（**注意：完全隐藏模式下会把 B 站的空占位块顶到内容中间，已在 v1.1.5 修复**） |
| `v1.1.5-beta/` | v1.1.5-beta | `v1.1.5-beta` | 收敛空占位块：完全隐藏时不再把末尾的空骨架顶到内容中间 |
| `v1.1.6-beta/` | v1.1.6-beta | `v1.1.6-beta` | 修命中词变化后完全隐藏的卡片不再恢复；去掉 `hasLayoutEngine()` 的永久缓存 |
| `v1.1.7-beta/` | v1.1.7-beta | `v1.1.7-beta` | 按「只有 v1.0.0 的完全隐藏好用」的反馈，新增「隐藏时保留原位置」开关并默认沿用 v1.0.0 行为 |
| `v1.1.8-beta/` | v1.1.8-beta | `v1.1.8-beta` | 重写「前移补位」路径：找网格、滚动抖动、空占位判定、楼层嵌套、撑高度的容器 |
| `v1.1.9-beta/` | v1.1.9-beta | `v1.1.9-beta` | 「保留位置」改为隐藏卡片自身，去掉白色空盒（**注意：外层带边框的容器仍会残留空框，已在 v1.2.0 修复**） |
| `v1.1.10-beta/` | v1.1.10-beta | `v1.1.10-beta` | 从卡片往上找「只装着这一张卡」的最外层容器一起隐藏；放宽尺寸安全阀到 1200×800 / 35%（**注意：外层容器实际并没被隐藏，样式规则没命中，已在 v1.2.0 修复**） |
| `v1.1.11-beta/` | v1.1.11-beta | `v1.1.11-beta` | 容器里的卡片全被隐藏时继续往上处理容器（**注意：同 v1.1.10，外层容器实际并没被隐藏，已在 v1.2.0 修复**） |
| `v1.1.12-beta/` | v1.1.12-beta | `v1.1.12-beta` | 修掉外层容器的隐藏样式没命中、分区徽标被当成标题、直播推广卡片识别不出来（内容与 v1.2.0 正式版一致，只差版本号） |

- 归档内容是各版本发布时的原始源码，**不会再更新**。
- 想直接安装某个旧版，也可以到 [Releases](https://github.com/ke25019/bili-title-filter/releases) 下载对应的 zip。
- 最新版本请使用仓库根目录的源码，或最新 Release。

---

## Archived versions (English)

This folder keeps **full source snapshots** of previous releases. Each subfolder is a
**standalone, loadable extension** (Edge: `edge://extensions/` → Developer mode → Load unpacked → pick the subfolder).

- The snapshots are frozen at release time and will not be updated.
- To install an older build directly, you can also grab the matching zip from [Releases](https://github.com/ke25019/bili-title-filter/releases).
- For the current version, use the repository root or the latest release.
