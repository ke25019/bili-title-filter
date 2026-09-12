# BiliTitleFilter · Bilibili Title Blocker

> A browser extension that filters Bilibili videos by the title keywords you choose.

[![version](https://img.shields.io/badge/version-1.1.7--beta-orange)](https://github.com/ke25019/bili-title-filter/releases)
[![manifest](https://img.shields.io/badge/Manifest-V3-blue)]()
[![browser](https://img.shields.io/badge/Edge%20%7C%20Chrome-Chromium-00aeec)]()
[![tests](https://img.shields.io/badge/tests-160%20passed-brightgreen)]()

A Manifest V3 extension for **Microsoft Edge / Google Chrome and other Chromium browsers**.
Block videos whose titles match your own keyword list: either **mask** them (cover and title merged into a single
placeholder block that reveals itself on hover) or **hide** them completely. It also filters section promotions such as
live streams and anime, and can hide the home-page carousel banner on its own.

---

## ⚠️ Beta Notice

The current release is **v1.1.7-beta**. It is feature-complete but still in testing — feedback is very welcome.

- Automated checks: 88 for the core blocking logic, 52 for the settings UI, 20 for the background service — **160 in total, all passing**.
- **Core principle of this release: rather skip than mis-block.** Whenever the extension cannot confidently identify a card, it skips that promo instead of risking a broken page.
- Known limitation: if Bilibili redesigns its pages, a few card selectors may need updating (see the FAQ below).
- Feedback: please open an [Issue](https://github.com/ke25019/bili-title-filter/issues) with the page URL and a screenshot if possible.
- Older versions (v1.0.0-beta / v1.1.0-beta / v1.1.3-beta / v1.1.4-beta / v1.1.5-beta / v1.1.6-beta) are archived under [`legacy/`](legacy/) and can each be loaded as a standalone extension.

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
| **Hide** | The video stops being displayed. By default the **original slot is kept** (same as v1.0.0-beta): only the card content is hidden, so the page neither re-flows nor shrinks and Bilibili's empty skeleton placeholders are not pulled into the middle of the feed. Turn off “keep the original slot” in the panel to remove the card from the layout entirely instead. |

- The mask text is customisable (Options → Blocking style → Mask text).
- Hover-to-reveal can be turned off; when it is off, the mask intercepts clicks so you cannot open a blocked video by accident.

### 3. Block section promotions (card level)

Once a section is ticked, its promo cards are handled **exactly like blocked videos**: cover and title are merged into a
single block, never “cover masked while the title stays visible”.

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

**Detection does not rely on a single class name, and every rule below was measured in a real browser (headless Edge + CDP):**

1. First it looks at where the links inside a card point (`live.bilibili.com`, `/bangumi/play/`, `/cheese/play/`, …)
2. Known card class names take priority (`.feed-card`, `.bili-video-card`, `.bili-feed-card`, …)
3. Some Bilibili areas use BEM naming, so element classes such as `bili-live-card__image--link` are resolved back to the card root `.bili-live-card`
4. Otherwise it **walks up to the first element that contains both a title and a cover** — which is exactly the card, so the mask covers cover + title by construction
5. The top navigation and hidden side promo areas (`.header-channel`, `.palette-button-inner`) are explicitly excluded
6. **Three safety valves**: the container holds other cards → treated as a list and skipped; it exceeds 1100×700 or 15 % of the viewport → skipped; it has zero size (hidden) → skipped

### 4. Hide the home-page carousel banner (separate switch)

Hides only the large auto-rotating banner at the very top of the home page (measured structure: `.vui_carousel` wrapping
11 `.carousel-area` slides, right below the header) — **no other page, no other content is touched**. It is an independent
switch and does not interact with the section checkboxes above.

### 5. Three places to configure it
- **Full options page** — section table, live preview, config import/export, statistics and reset.
- **In-page floating panel** — sits near the top bar, **hold and drag it anywhere**; the position is remembered (and can be reset with one click). Click to expand the panel.

### 6. Empty placeholder blocks in hide mode

Bilibili’s feed grid keeps a number of **skeleton-only empty placeholder items** at the end of the grid; they are filled
with real content as you scroll. Once we hide the cards before them, CSS Grid **pulls those placeholders forward** to fill
the freed cells — which looks like grey empty boxes appearing in the middle of the content.

The extension now handles this automatically in hide mode: pulled-up empty placeholders are collapsed
(plain ones are hidden outright; load sentinels such as `.load-more-anchor` are only made invisible so their layout box
and position survive and Bilibili keeps loading). A placeholder is restored the moment it receives real content.
Measured: visible skeletons 89 → 18 (the remainder live inside the top-left carousel block and are real content),
and scrolling to the bottom still loads new content as usual.

### 7. Dark mode support
- The mask and the in-page panel follow Bilibili’s own dark mode automatically.
- Detection uses the `<html>` `dark` attribute / `data-theme` / class names, with a background-luminance fallback.
- You can also force “always light” or “always dark”.

### 8. Extras
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
│   └── content.css        # Injected styles: mask, hover reveal, banner hiding, dark-mode variables
├── popup/                 # Toolbar popup (quick settings)
│   ├── popup.html / popup.css / popup.js
├── options/               # Full options page
│   ├── options.html / options.css / options.js
├── legacy/                # Archived older versions (each loadable as its own extension)
│   ├── v1.0.0-beta/
│   ├── v1.1.0-beta/
│   └── v1.1.3-beta/
├── tests/                 # jsdom automated checks (not part of the shipped extension)
└── icons/                 # 16 / 32 / 48 / 128 icons
```

---

## Development & tests

The extension itself has zero runtime dependencies — plain JavaScript (MV3 + Shadow DOM).

```bash
cd tests
npm install      # jsdom is only needed for the tests
npm test         # 129 behaviour checks
```

Coverage: blocking logic and both blocking styles, hover reveal, **cover+title merged masking on the real promo-card
structure**, 14 section types plus the catch-all rule, the carousel-banner switch, navigation safety,
**oversized-container and hidden-element safety valves (page-blanking prevention)**, floating button dragging and
position persistence, popup / options interactions, and the background statistics & badge. See `tests/README.md`.

> The mock DOM and its sizes (`data-w` / `data-h`) come from **real-browser CDP measurements**, including the
> utility-class structure `.floor-card-inner > .cover-container + .pb-16.px-12 > p.title`.

---

## FAQ

**Q: I ticked a section but content from it is still visible.**
A: Since v1.1.4 section blocking is **card level only**: when the extension cannot confidently identify the card holding both cover and title, it skips that promo (rather skip than mis-block). If the content you mean is the big banner at the top of the home page, use the separate **“Hide the home-page carousel banner”** switch.

**Q: Some promo cards don’t belong to any section I can see.**
A: Turn on the **“Other promos”** catch-all. It picks up every promo card not covered by the 13 specific types (app downloads, other channel promos, external links) and only applies when a card matches no specific type — so turning “Live” off will not silently block live cards again.

**Q: The page went blank or the layout broke.**
A: v1.1.4-beta reproduced this in a real browser (Edge + CDP) and fixed the root cause: an oversized element (the whole feed, or the hidden side-button container) was mistaken for a single card and masked. Three safety valves now guard this — a container holding other cards, a size above 1100×700 or 15 % of the viewport, or a zero-size element all cause the block to be skipped. If it still happens, enable “output debug logs” in the options page and post the `[B站屏蔽助手]` console lines together with the page URL in an Issue.

**Q: After blocking, part of the page is blank or the layout looks broken.**
A: A card selector probably needs updating after a Bilibili redesign. Try the **Mask** style first, or add the new class names to `CARD_SELECTOR` / `TITLE_SELECTORS` in `content/content.js`.

**Q: Why was a video not blocked?**
A: Check whether the keyword really appears in the title. With “case sensitive” or “regular expression” enabled, matching is stricter. You can also enable “output debug logs” in the options page and inspect the console on the Bilibili tab.

**Q: Does it slow the page down?**
A: Scanning uses `MutationObserver` with a 180 ms debounce and only processes newly added or changed cards. Section detection only runs while the corresponding switches are on, and it is rate- and count-limited.

**Q: The statistics are higher than the number of videos I actually saw blocked.**
A: Bilibili is a single-page app: scrolling and navigation re-render cards, so the counter approximates the number of blocking actions rather than unique videos.

---

## Version

**v1.1.7-beta** · Requires Microsoft Edge (Chromium) 102+ (`minimum_chrome_version: 102`)

### Changelog

**v1.1.7-beta**

> Following your hint, this release went back to v1.0.0-beta - **only its hide mode behaves the way you want**.
> Running both versions against the same real DOM revealed the root cause.

- **Root cause: the hiding target changed**

  | Card kind | v1.0.0-beta.1 | from v1.1.0 |
  | --- | --- | --- |
  | Cards wrapped in `.feed-card` | hides `.feed-card` (the grid item) | same |
  | **`.bili-feed-card` that is itself a grid item** | **hides only the inner `.bili-video-card`** - grid item stays, **no reflow** | **hides the `.bili-feed-card` grid item** - **the entire grid reflows** |

  The difference came from adding `.bili-feed-card` to the card selector in v1.1.0. Reflow causes both symptoms you reported:
  the freed cells get filled with Bilibili's **empty skeleton placeholders** from the end of the grid (grey blocks mid-content),
  and the page becomes shorter overall (blank space at the bottom).

- **New switch: "keep the original slot when hiding"** (on by default = v1.0.0 behaviour)
  * **On (default)**: only the card content is hidden, the slot stays -> no reflow, no shrinking, no placeholders pulled up
  * **Off**: the card is removed from the layout and later cards move up (reflow; the extension then collapses the pulled-up empty placeholders)

  The switch only appears when Hide mode is selected (in the panel and the popup); it is also in the options page.
- **Placeholder collapsing now only runs in "remove slot" mode** (with the slot kept there is no reflow, so nothing is pulled up)
- Checks grew 142 -> 160, with 18 new assertions covering both hide behaviours, their CSS rules and the switch wiring

**v1.1.6-beta**

> This release re-examines hide mode. An A/B comparison was run in an isolated headless instance
> (extension disabled vs. hide mode active).

- **Fixed: after switching from Hide back to Mask, some cards stayed hidden forever.**
  The size safety valve in `applyBlock` keyed off “is the match reason unchanged”; in hide mode a card is
  `display:none` (zero size), so as soon as the matching keyword changed (e.g. you blocked “游” and later added “我”)
  the valve misjudged it and refused to process the card, leaving it hidden permanently.
  It now checks “has this card ever been blocked”, so the size check only runs for a first-time block.
- **Fixed: `hasLayoutEngine()` cached its result permanently.**
  If it was first called before `body` had a layout, the cache stuck at `false` and the size safety valve was
  effectively disabled for the whole session. It is no longer cached.
- **Investigation result (with evidence): the blank blocks seen in hide mode are not caused by the extension.**
  In the A/B run the number of “empty blocks” (no text, no loaded image) was identical with the extension disabled
  and with hide mode active — 15 in both cases — and their ancestry shows they are all Bilibili’s own
  `extension-tips-v2` panels inside the top-left `.vui_carousel`. The bottom blank measured only 60px in the same setup.
- Test hardening: the statistics assertion now polls instead of relying on a fixed delay; three consecutive full runs are stable.
- Checks grew 137 → 142; v1.1.5-beta archived under `legacy/`.

**v1.1.5-beta**

- **Fixed: grey/white placeholder blocks appearing in the middle of the content in hide mode.**
  Bilibili’s feed grid keeps skeleton-only empty placeholder items at the end; hiding cards makes CSS Grid pull them
  forward into the freed cells. They are now collapsed (plain ones hidden, load sentinels such as `.load-more-anchor`
  only made invisible so Bilibili keeps loading). Measured: visible skeletons 89 → 18.
- Loading still works after the collapse (real cards 14 → 22 while scrolling to the bottom).

**v1.1.4-beta**

> This release was **rewritten after measuring the real site**: the extension was loaded into a headless Edge instance
> driven over CDP, every switch was tested one by one, and the evidence (`palette-button-inner` at 1401×808, plus two
> separate masks on `cover-container` and `pb-16 px-12`) drove the changes below.

- **Fixed: enabling a section such as “Events” blanked the whole page.** The walk-up started from a hidden 0×0 promo link, jumped three levels and landed on a 1401×808 container (98.9 % of the viewport). The **“block whole rows” feature and all its logic were removed** and three safety valves were added; “Events” now blocks nothing on the home page
- **Fixed: promo cover and title were masked separately.** Real live promo cards use utility classes (`.floor-card-inner > .cover-container` + `.pb-16.px-12 > p.title`). The masking target is now **the first ancestor containing both a title and a cover**, verified to produce a single mask covering the whole card (238×224)
- **Removed “block whole rows too”** and replaced it with a separate **“Hide the home-page carousel banner”** switch that only hides the top banner (measured: `.vui_carousel` wrapping 11 `.carousel-area` slides)
- **Fixed: hidden 0×0 elements treated as cards** — zero-size elements are now skipped wherever a layout engine exists
- **Much stricter identification**: size above 1100×700 or 15 % of the viewport, a container holding other cards, or multiple same-section entries inside — any of these means “skip”
- Exclusion list extended with the hidden promo areas found during testing: `.header-channel`, `.palette-button-outer/inner`
- Legacy “whole row” settings are migrated to the new carousel-banner switch
- 129 checks (67 content / 42 UI / 20 background); v1.1.3-beta archived under `legacy/`

**v1.1.3-beta**

- Blank-page / broken-layout fixes (**not fully resolved — v1.1.4 found the real root cause in a live browser**)
- Fixed the whole-row switch damaging the page; section types grew from 9 to 14 with an “other promos” catch-all
- Mask height measured while hidden; section labels shortened and made non-wrapping

**v1.1.0-beta**

- **Fixed: section promotion blocking had no effect** — detection is now class-independent
- Added whole-row section blocking (**removed again in v1.1.4**)
- Mask reveals on hover; the floating button can be dragged and remembers its position
- Fixed unblocking of generically detected cards; fixed partial settings resetting booleans to false

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
