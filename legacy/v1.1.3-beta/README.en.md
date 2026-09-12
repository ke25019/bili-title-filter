# BiliTitleFilter · Bilibili Title Blocker

> A browser extension that filters Bilibili videos by the title keywords you choose.

[![version](https://img.shields.io/badge/version-1.1.3--beta-orange)](https://github.com/ke25019/bili-title-filter/releases)
[![manifest](https://img.shields.io/badge/Manifest-V3-blue)]()
[![browser](https://img.shields.io/badge/Edge%20%7C%20Chrome-Chromium-00aeec)]()
[![tests](https://img.shields.io/badge/tests-142%20passed-brightgreen)]()

A Manifest V3 extension for **Microsoft Edge / Google Chrome and other Chromium browsers**.
Block videos whose titles match your own keyword list: either **mask** them (cover and title merged into a single
placeholder block that reveals itself on hover) or **hide** them completely. It also filters section promotions such as
live streams and anime, and ships an in-page quick panel that you can drag anywhere.

---

## ⚠️ Beta Notice

The current release is **v1.1.3-beta**. It is feature-complete but still in testing — feedback is very welcome.

- Automated checks: 80 for the core blocking logic, 43 for the settings UI, 19 for the background service — **142 in total, all passing**.
- Known limitation: if Bilibili redesigns its pages, a few card selectors may need updating (see the FAQ below).
- Feedback: please open an [Issue](https://github.com/ke25019/bili-title-filter/issues) with the page URL and a screenshot if possible.
- Older versions (v1.0.0-beta / v1.1.0-beta) are archived under [`legacy/`](legacy/) and can each be loaded as a standalone extension.

---

## Features

### 1. Block videos by title keyword
- Add or remove keywords in bulk; multiple keywords are combined with OR.
- Matching options: **case sensitive**, **regular expressions**, **match the uploader name as well**.
- Changes take effect immediately; every open Bilibili tab is rescanned automatically.

### 2. Two blocking styles

| Style | Behaviour |
| --- | --- |
| **Mask** | The cover and title are merged into one block showing “根据您的屏蔽词已将此视频屏蔽”. The layout stays intact, and **hovering the mouse reveals the video**; moving the pointer away masks it again. |
| **Hide** | The card is removed from the page entirely (`display:none`) — **as if the video never existed**. |

- The mask text is customisable (Options → Blocking style → Mask text).
- Hover-to-reveal can be turned off; when it is off, the mask intercepts clicks so you cannot open a blocked video by accident.

### 3. Block section promotions (two independent levels)

| Level | Description |
| --- | --- |
| **Card level** | Blocks only the individual cards of that section; the rest of the page is untouched. |
| **Row / block level** | Hides the whole promo row for that section — including the home-page carousel banner, floor blocks and their headings. |

Available sections (**14 types**, based on the real Bilibili domains and paths):

| Label | Coverage |
| --- | --- |
| Live | `live.bilibili.com` cards and live promo slots |
| Anime | `/bangumi/`, `/anime/`, `/guochuang/` (including the top carousel) |
| Movies & TV | `/movie/`, `/tv/`, `/documentary/`, `/variety/` |
| Courses | `/cheese/` paid courses |
| Articles | `/read/` |
| Dynamics | `/opus/`, `t.bilibili.com` |
| Manga | `manga.bilibili.com`, `/manga/` |
| Games | `game.bilibili.com`, `/v/game` |
| Music | `music.bilibili.com`, `/audio/` |
| Esports | `/match/`, `/esports/` |
| Merch store | `love.bilibili.com`, `show.bilibili.com`, `/mall/` |
| Events | `/blackboard/`, `/festival/`, `/topic/`, `/platform/` |
| Ads | `cm.` / `ad.bilibili.com` and cards badged as ads |
| **Other promos** | **Catch-all**: promos linking to other channels, app downloads (`app.` / `m.bilibili.com`) or external sites |

> “Other promos” is a catch-all and only applies when a card matches **none** of the specific types above,
> so turning “Live” off will not silently block live cards again.

**Detection does not rely on a single class name, so it survives most Bilibili redesigns:**

1. First it looks at where the links inside a card point (`live.bilibili.com`, `/bangumi/play/`, `/cheese/play/`, …)
2. Bilibili uses BEM naming, so element classes such as `bili-live-card__image--link` are resolved back to the card root `.bili-live-card`
3. Then it falls back to card class names measured on the real site (`.feed-card`, `.bili-live-card`, `.anime-list-item`, …)
4. If a card is not in the known list, it **walks up from the matching link to infer the card container**
5. The top navigation (e.g. the “直播” / “番剧” entries) is explicitly excluded, so it is never blocked by mistake
6. **Safety valves**: if the inferred container looks like a list (it holds other cards) or is far larger than a single card, blocking is skipped — better to miss one promo than to blank out the page

### 4. Three places to configure it
- **Toolbar popup** — quick toggles and keyword management.
- **Full options page** — section table, live preview, config import/export, statistics and reset.
- **In-page floating panel** — sits near the top bar, **hold and drag it anywhere**; the position is remembered (and can be reset with one click). Click to expand the panel.

### 5. Dark mode support
- The mask and the in-page panel follow Bilibili’s own dark mode automatically.
- Detection uses the `<html>` `dark` attribute / `data-theme` / class names, with a background-luminance fallback.
- You can also force “always light” or “always dark”.

### 6. Extras
- The toolbar badge shows how many videos were blocked today; totals are shown in the options page and can be reset.
- Configuration can be **exported / imported as JSON** for backup or multi-machine use.
- Settings live in `chrome.storage.sync`, so they sync across devices when you sign in to the browser.
- All injected UI uses **Shadow DOM with `bf-` prefixed class names** and never pollutes Bilibili’s own styles.

---

## Installation (Microsoft Edge)

**Option 1 — download the package (recommended)**

1. Open the [Releases page](https://github.com/ke25019/bili-title-filter/releases) and download `bili-title-filter-vX.Y.Z-beta.zip`.
2. Extract it to any folder (do not delete the extracted folder afterwards).
3. In Edge, go to `edge://extensions/` and enable **Developer mode** (bottom-left).
4. Click **Load unpacked** and select the extracted folder (the one containing `manifest.json`).

**Option 2 — clone the repository**

```bash
git clone https://github.com/ke25019/bili-title-filter.git
```

Then follow steps 3 and 4 above with the cloned folder.

> Chrome users: same steps, but open `chrome://extensions/`.

---

## Usage

1. Click the extension icon in the toolbar, or the “屏蔽助手” button near Bilibili’s top bar.
2. Type a keyword into **Title keywords** and press Enter. Examples:
   - `剧透` (spoilers)
   - `营销号` (clickbait accounts)
   - `标题党` (clickbait titles)
   - With regex enabled you can use patterns such as `^\s*【.*?】` or `(合集|盘点)\s*第?\d+`.
3. Choose a blocking style: **Mask** (hover to peek) or **Hide**.
4. To filter section promotions, tick the sections you do not want. To remove the whole promo row as well, turn on the **“整行板块也一起屏蔽”** (block whole rows too) switch below the grid.
5. **Hold and drag** the floating button to move it; the position is saved automatically. Use **重置位置** (reset position) in the panel footer to restore the default spot.
6. Fine-grained options (per-section card/row switches, regex, uploader matching, custom text, import/export, statistics) live in the **full options page**.

### Supported pages
Home feed, search results, channel pages, rankings, the “related videos” sidebar on watch pages, the dynamics page, and other common video lists.

---

## Project layout

```
bili-title-filter/
├── manifest.json          # MV3 manifest
├── background.js          # Service worker: statistics, badge, defaults, open options page
├── shared/
│   └── defaults.js        # Shared defaults + section type definitions (with detection rules)
├── content/
│   ├── content.js         # Content script: scanning / matching / blocking, section detection, draggable panel
│   └── content.css        # Injected styles: mask, hover reveal, block hiding, dark-mode variables
├── popup/                 # Toolbar popup (quick settings)
│   ├── popup.html / popup.css / popup.js
├── options/               # Full options page
│   ├── options.html / options.css / options.js
├── legacy/                # Archived older versions (each loadable as its own extension)
│   ├── v1.0.0-beta/
│   └── v1.1.0-beta/
├── tests/                 # jsdom automated checks (not part of the shipped extension)
└── icons/                 # 16 / 32 / 48 / 128 icons
```

---

## Development & tests

The extension itself has zero runtime dependencies — plain JavaScript (MV3 + Shadow DOM).

```bash
cd tests
npm install      # jsdom is only needed for the tests
npm test         # 142 behaviour checks
```

Coverage: blocking logic and both blocking styles, hover reveal, card-level and row-level section detection,
14 section types plus the catch-all rule, navigation safety, **oversized-container safety valves (page-blanking prevention)**,
floating button dragging and position persistence, popup / options interactions, and the
background statistics & badge. See `tests/README.md` for details.

---

## FAQ

**Q: I ticked a section but content from it is still visible.**
A: Section blocking has two levels. **Card level** only handles individual cards. If the content appears as a whole promo row or the top carousel banner, turn on the **row/block level** switch on the same line. Note that the combined switch in the panel/popup only applies to sections whose **card-level** box is ticked; with nothing ticked it just reminds you to pick a section first.

**Q: Some promo cards don’t belong to any section I can see.**
A: Turn on the **“Other promos”** catch-all. It picks up every promo card not covered by the 13 specific types (app downloads, other channel promos, external links) and only applies when a card matches no specific type — so turning “Live” off will not silently block live cards again.

**Q: The page went blank or the layout broke.**
A: v1.1.3-beta adds multiple safety valves for the root cause (an oversized container such as the whole feed being mistaken for a single card). If it still happens, switch to **Hide** mode temporarily and report it in Issues with the page URL and a screenshot; enabling “output debug logs” in the options page makes the console print the detected containers, which helps a lot.

**Q: After blocking, part of the page is blank or the layout looks broken.**
A: A card selector probably needs updating after a Bilibili redesign. Try the **Mask** style first, or add the new class names to `CARD_SELECTOR` / `TITLE_SELECTORS` in `content/content.js`.

**Q: Why was a video not blocked?**
A: Check whether the keyword really appears in the title. With “case sensitive” or “regular expression” enabled, matching is stricter. You can also enable “output debug logs” in the options page and inspect the console on the Bilibili tab.

**Q: Does it slow the page down?**
A: Scanning uses `MutationObserver` with a 180 ms debounce and only processes newly added or changed cards. Generic section detection and row scanning only run when the corresponding switches are enabled, and they are rate- and count-limited.

**Q: The statistics are higher than the number of videos I actually saw blocked.**
A: Bilibili is a single-page app: scrolling and navigation re-render cards, so the counter approximates the number of blocking actions rather than unique videos.

---

## Version

**v1.1.3-beta** · Requires Microsoft Edge (Chromium) 102+ (`minimum_chrome_version: 102`)

### Changelog

**v1.1.3-beta**

- **Fixed: blank areas and broken layouts.** The root cause was section detection mistaking an oversized container (the whole feed) for a single card and masking it, leaving an empty box behind. Multiple guards were added: a container holding other cards is treated as a list, anything far larger than a card is skipped, and BEM element classes are always resolved back to the card root
- **Fixed: the “block whole rows too” switch could damage the whole page.** Previously, clicking it with no section selected turned on block-level blocking for every section; it now only applies to sections whose card-level box is ticked, and otherwise shows a “pick a section first” hint
- **Fixed: the mask covered only the cover while the title stayed visible.** BEM block-root resolution (`bili-live-card__image--link` → `.bili-live-card`) plus automatic expansion to the level containing the title, so promos are now masked exactly like videos — **cover and title as one block**
- **New: section types grew from 9 to 14** — games, music, esports, merch store (love/show), courses, articles and more, based on the real domains and paths, plus an **“Other promos” catch-all** for unclassified promos (app downloads, other channel promos, …)
- **Fixed: card height measured while hidden**, which wrongly compressed the mask content
- Section labels in the panel and popup are now short and never wrap, so the grid stays aligned
- Added a `legacy/` folder archiving v1.0.0-beta and v1.1.0-beta sources; checks grew from 118 to 142

**v1.1.0-beta**

- **Fixed: section promotion blocking had no effect.** Detection is now class-independent (the type is inferred from where a card’s links point), plus real class names measured in 2025 were added (`.bili-live-card`, `.feed-card`, `.anime-list-item`, …)
- **New: section blocking is split into two independent levels** — card level and row/block level. The block level can hide whole promo rows, floor headings and the home-page carousel banner
- **Changed: the mask now reveals the video on mouse hover** and re-masks when the pointer leaves (can be disabled)
- **New: the in-page floating button can be dragged anywhere**, its position is remembered, and it can be reset
- **Fixed: cards found by generic detection could not be restored** after turning a section switch off
- **Fixed: a partial settings object reset every boolean option to false** (which could make the floating button disappear)

**v1.0.0-beta.1** (first public beta)

- Block videos by title keyword, with bulk management, regex, case sensitivity and uploader matching
- Two blocking styles: mask / hide
- Section promotion blocking, in-page floating panel, dark mode support, toolbar badge statistics

### Roadmap

- [ ] Blocking by uploader / view count / duration / finer section granularity
- [ ] Allowlist and “always show” rules
- [ ] Keyword groups and switchable profiles
- [ ] A blocking log panel (see exactly what was blocked today)

---

## Other languages

- [中文文档（Chinese）](README.zh-CN.md)

---

## License

This repository currently ships without a license file; all rights are reserved by the author.
Please open an Issue first if you want to use it in another project.
