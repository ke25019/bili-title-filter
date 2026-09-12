# BiliTitleFilter · B站屏蔽助手

> 按标题屏蔽词过滤 B 站视频的浏览器扩展 · A browser extension that filters Bilibili videos by title keywords.

[![version](https://img.shields.io/badge/version-1.1.3--beta-orange)](https://github.com/ke25019/bili-title-filter/releases)
[![manifest](https://img.shields.io/badge/Manifest-V3-blue)]()
[![browser](https://img.shields.io/badge/Edge%20%7C%20Chrome-Chromium-00aeec)]()
[![tests](https://img.shields.io/badge/tests-142%20passed-brightgreen)]()

**适用于 Microsoft Edge / Chrome 等 Chromium 浏览器的 B 站网页端扩展（Manifest V3）。**

---

## 📖 选择语言 / Choose your language

| 语言 Language | 文档 Documentation |
| --- | --- |
| 🇨🇳 简体中文 | **[README.zh-CN.md](README.zh-CN.md)** |
| 🇬🇧 English | **[README.en.md](README.en.md)** |

---

## 它能做什么 / What it does

- **按标题屏蔽词屏蔽视频** —— 支持批量管理、正则、区分大小写、匹配 UP 主名称
- **两种屏蔽方式** —— 整体遮蔽（封面与标题合并成一块提示区域，**鼠标悬停即可查看**）或完全隐藏（如同从未出现）
- **屏蔽分区推广** —— **14 类**：直播、番剧、影视、课堂、专栏、动态、漫画、游戏、音乐、赛事、会员购、活动、广告 + **「其他推广」兜底**；**卡片级 / 整行板块级两个粒度独立开关**；识别不依赖单一 class，改版不易失效
- **B 站页面内悬浮面板** —— 位于标题栏附近，**可自由拖动**并记住位置，随时调整所有属性
- **深色模式适配** —— 自动跟随 B 站 web 端深色模式，也可手动锁定

- **Block videos by title keywords** — bulk management, regex, case sensitivity, uploader matching
- **Two blocking styles** — mask (cover + title merged into one block, **reveals on hover**) or hide entirely
- **Block section promotions** — **14 types**: live, anime, movies, courses, articles, dynamics, manga, games, music, esports, merch store, events, ads, plus an **“other promos” catch-all** — with **independent card-level / row-level switches**
- **Draggable in-page panel** near the top bar, position remembered, all settings at hand
- **Dark mode support** — follows Bilibili’s dark theme automatically, or force light/dark

---

## 快速开始 / Quick start

1. 打开 [Releases 页面](https://github.com/ke25019/bili-title-filter/releases) 下载最新版压缩包并解压
2. Edge 打开 `edge://extensions/` → 开启「开发人员模式」→「加载解压缩的扩展」→ 选择解压出的文件夹（含 `manifest.json`）

1. Download the latest zip from the [Releases page](https://github.com/ke25019/bili-title-filter/releases) and extract it
2. In Edge, open `edge://extensions/`, enable **Developer mode**, click **Load unpacked** and pick the extracted folder

完整安装步骤与使用说明见上方对应语言的文档。
Full instructions are available in the language-specific documents linked above.

---

## 自动化校验 / Automated checks

```bash
cd tests
npm install
npm test        # 142 项校验全部通过 / 142 checks, all passing
```

本扩展的代码是纯原生 JavaScript、零运行时依赖。
The extension itself is plain JavaScript with zero runtime dependencies.
