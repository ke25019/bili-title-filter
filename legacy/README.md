# 旧版本归档 / Archived versions

这里保存历史版本的**完整源码快照**，每个子目录都是一个**可以直接加载的独立扩展**
（Edge：`edge://extensions/` → 开发人员模式 → 加载解压缩的扩展 → 选择对应子目录）。

| 目录 | 版本 | 标签 | 说明 |
| --- | --- | --- | --- |
| `v1.0.0-beta/` | v1.0.0-beta.1 | `v1.0.0-beta.1` | 首个公开测试版：标题屏蔽词、两种屏蔽方式、9 类分区推广、页面内悬浮面板、深色模式 |
| `v1.1.0-beta/` | v1.1.0-beta | `v1.1.0-beta` | 分区通用识别、悬停自动展示、可拖动悬浮按钮（**注意：该版本存在"分区识别误遮蔽整页"的缺陷**） |
| `v1.1.3-beta/` | v1.1.3-beta | `v1.1.3-beta` | 补全 14 类分区与「其他推广」兜底、新增「整行板块」功能（**注意：该版本的整行板块与过大容器识别存在缺陷，已在 v1.1.4 移除/修复**） |
| `v1.1.4-beta/` | v1.1.4-beta | `v1.1.4-beta` | 移除整行板块、改为独立轮播横幅开关、重写分区卡片识别（**注意：完全隐藏模式下会把 B 站的空占位块顶到内容中间，已在 v1.1.5 修复**） |

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
