# B站屏蔽助手 · BiliTitleFilter

[![License: PolyForm Noncommercial](https://img.shields.io/badge/License-PolyForm_Noncommercial-orange.svg)](https://polyformproject.org/licenses/noncommercial/1.0.0/)
![version](https://img.shields.io/badge/version-1.6.1-orange)
![browser](https://img.shields.io/badge/Edge%20%7C%20Chrome-Chromium-00aeec)
[![Microsoft Edge Add-ons](https://img.shields.io/badge/Microsoft%20Edge-Add--ons-00aeec)](https://microsoftedge.microsoft.com/addons/detail/mnedaofgbbcdgpoobimgbceabkchkaif)
![tests](https://img.shields.io/badge/tests-326%20passed-brightgreen)

一个 B 站网页端扩展：给不想看的视频标题加几个关键词，它们就从页面上消失；也能按分区屏蔽直播、番剧这类推广内容。

A Bilibili web extension: add a few keywords to filter out video titles you don’t want to see, and they disappear from the page; it can also block promoted content by category, such as live streams and anime.

---

## 文档 / Documentation

| | |
| --- | --- |
| 简体中文 | [README.zh-CN.md](README.zh-CN.md) |
| English | [README.en.md](README.en.md) |

---

## 安装 / Install

**中文：**
1. 到 [Microsoft Edge 加载项商店](https://microsoftedge.microsoft.com/addons/detail/mnedaofgbbcdgpoobimgbceabkchkaif) 点「获取」，浏览器会自动装好，以后也会自动更新。
2. 想手动装、或者要试测试版，就到 [Releases](https://github.com/ke25019/bili-title-filter/releases) 下载 zip 解压，然后在 `edge://extensions/` 打开「开发人员模式」→「加载解压缩的扩展」，选到含 `manifest.json` 的那一层。

**English:**
1. Install from the [Microsoft Edge Add-ons store](https://microsoftedge.microsoft.com/addons/detail/mnedaofgbbcdgpoobimgbceabkchkaif) — it installs and updates itself.
2. To install manually, or to run a beta, download the zip from [Releases](https://github.com/ke25019/bili-title-filter/releases), extract it, then in `edge://extensions/` turn on **Developer mode** → **Load unpacked** → pick the folder containing `manifest.json`.

详细说明和常见问题都在上面那两个文档里。
Details and the FAQ live in the two documents linked above.

遇到问题、发现屏蔽失效、想提新功能，都到 [Discussions](https://github.com/ke25019/bili-title-filter/discussions) 发帖。
Questions, broken blocks and feature ideas all go to [Discussions](https://github.com/ke25019/bili-title-filter/discussions).

---

## 简单说说 / In short

- 按标题关键词屏蔽视频，支持正则、区分大小写、匹配 UP 主名字
- 两种效果：整体遮蔽（封面标题合成一块，鼠标悬停能看）和完全隐藏（默认保留原位置，页面不重排）
- UP 白名单：名单里的 UP 不会被屏蔽（按 UP 名字）
- 18 类分区推广可以整类屏蔽（番剧、国创、综艺、电影这些是分开的），另有「其他推广」兜底，以及一个单独的开关用来屏蔽首页顶部的大轮播横幅
- **播放器页面屏蔽**（默认开启，页面内面板里也有这个开关）：一键收掉播放页的广告位 —— 播放器下方的横幅、右栏广告卡、右栏推荐流里的推广卡、播放器活动横幅，都是整块移除、不盖遮罩；只收广告位本体，不碰播放器、弹幕与顶栏
- B 站页面里有一个可以拖着走的悬浮面板
- 跟随 B 站深色模式
- 页面级开关：站内搜索结果页默认屏蔽、UP 个人主页默认不屏蔽，登录页一律不屏蔽
- 扩展包内含**简体中文与英文**两种语言（`_locales/`，manifest 用 `__MSG_` 占位）——扩展商店就是读这套配置来决定显示哪些语言选项的

- Block by title keyword, with regex, case sensitivity and uploader matching
- Two styles: mask (cover and title merged into one block, reveals on hover) and hide (keeps the slot by default, so the page doesn't reflow)
- An uploader whitelist: uploaders on it are never blocked (by name)
- Eighteen promo categories, each with its own switch (anime, Chinese animation, variety shows and movies are separate), an "other promos" catch-all, and a separate switch that blocks the home-page carousel banner
- **Playback-page blocking** (on by default, with a switch in the in-page panel too): one click removes the ad slots on video pages — the banner below the player, the right-column ad card, the promo card in the right-hand recommendation list and the player activity banner — all removed outright with no mask; only the slots themselves, never the player, danmaku or header
- A draggable panel inside the page
- Follows Bilibili's dark mode

纯原生 JavaScript，没有运行时依赖。测试用 jsdom 跑，一共 326 项。

Plain JavaScript, no runtime dependencies. The tests run on jsdom — 326 checks in total.

---

## 声明 / Notice

- 此项目包含AI生成内容。
- This project includes AI-generated content.

---

## 许可证 / License

本项目基于 [PolyForm Noncommercial License 1.0.0](LICENSE) 发布。

你可以为非商业目的自由使用、修改和分发本软件，但必须保留原始版权声明，且不得用于任何商业用途。

Copyright (c) 2026 ke25019

This project is licensed under the [PolyForm Noncommercial License 1.0.0](LICENSE).

You may use, modify and distribute this software for noncommercial purposes only, provided you retain the original copyright notice. Commercial use is not permitted.

Copyright (c) 2026 ke25019

---

## 免责声明 / Disclaimer

1. **非官方工具**：本项目为个人开源项目，与哔哩哔哩（B站）官方无任何关联，未获得 B站的官方授权或认可。
   **Unofficial Tool**: This is a personal open-source project and is not affiliated with, authorized, or endorsed by Bilibili.

2. **使用风险**：本工具通过注入脚本修改 B站页面内容，可能违反 B站《用户使用协议》中关于禁止使用自动化脚本获取或干预平台内容的相关条款。用户应自行评估使用风险。
   **Usage Risk**: This tool modifies Bilibili's page content via script injection, which may violate Bilibili's Terms of Service regarding automated scripts. Users should evaluate the risks themselves.

3. **数据安全**：本扩展仅读取页面本地数据用于过滤操作，不收集、不上传任何用户个人信息至外部服务器。
   **Data Security**: This extension only reads local page data for filtering and does not collect or upload any personal information.

4. **责任限制**：本软件按“原样”提供，不提供任何明示或暗示的担保。作者不对因使用本工具导致的账号封禁、数据丢失或其他损失承担责任。
   **Limitation of Liability**: This software is provided "as is" without any warranties. The author is not liable for any account bans, data loss, or other damages resulting from the use of this tool.
