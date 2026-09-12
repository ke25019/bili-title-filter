# B站屏蔽助手 · BiliTitleFilter

一个 B 站网页端扩展：给不想看的视频标题加几个关键词，它们就从页面上消失；也能按分区屏蔽直播、番剧这类推广内容。

An extension I wrote for myself to filter Bilibili. Add a few keywords and the videos whose titles contain them disappear; it can also block whole categories of promoted content, like live streams and anime.

![version](https://img.shields.io/badge/version-1.2.0-orange)
![browser](https://img.shields.io/badge/Edge%20%7C%20Chrome-Chromium-00aeec)
![tests](https://img.shields.io/badge/tests-192%20passed-brightgreen)

---

## 文档 / Documentation

| | |
| --- | --- |
| 简体中文 | [README.zh-CN.md](README.zh-CN.md) |
| English | [README.en.md](README.en.md) |

---

## 装一下 / Install

1. 到 [Releases](https://github.com/ke25019/bili-title-filter/releases) 下载最新的 zip，解压到一个固定目录
2. Edge 打开 `edge://extensions/`，左下角打开「开发人员模式」，点「加载解压缩的扩展」，选到含 `manifest.json` 的那一层

1. Download the latest zip from [Releases](https://github.com/ke25019/bili-title-filter/releases) and extract it somewhere permanent
2. Open `edge://extensions/`, turn on **Developer mode**, click **Load unpacked**, pick the folder containing `manifest.json`

详细说明和常见问题都在上面那两个文档里。
Details and the FAQ live in the two documents linked above.

---

## 简单说说 / In short

- 按标题关键词屏蔽视频，支持正则、区分大小写、匹配 UP 主名字
- 两种效果：整体遮蔽（封面标题合成一块，鼠标悬停能看）和完全隐藏（默认保留原位置，页面不重排）
- 14 类分区推广可以整类屏蔽，另有「其他推广」兜底和单独的首页轮播横幅开关
- B 站页面里有一个可以拖着走的悬浮面板
- 跟随 B 站深色模式

- Block by title keyword, with regex, case sensitivity and uploader matching
- Two styles: mask (cover and title merged into one block, reveals on hover) and hide (keeps the slot by default, so the page doesn't reflow)
- Fourteen promo categories, an "other promos" catch-all, and a separate switch for the home-page banner
- A draggable panel inside the page
- Follows Bilibili's dark mode

纯原生 JavaScript，没有运行时依赖。测试用 jsdom 跑，一共 192 项。

Plain JavaScript, no runtime dependencies. The tests run on jsdom — 192 checks in total.
