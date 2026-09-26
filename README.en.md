# BiliTitleFilter

An extension I wrote for myself to filter Bilibili. Add a few keywords and the videos whose titles contain them disappear from the page. It can also block whole categories of promoted content, like live streams and anime.

Manifest V3, works in Edge and Chrome, plain JavaScript with no runtime dependencies.

![version](https://img.shields.io/badge/version-1.6.1-orange)
![browser](https://img.shields.io/badge/Edge%20%7C%20Chrome-Chromium-00aeec)
[![Microsoft Edge Add-ons](https://img.shields.io/badge/Microsoft%20Edge-Add--ons-00aeec)](https://microsoftedge.microsoft.com/addons/detail/mnedaofgbbcdgpoobimgbceabkchkaif)
![tests](https://img.shields.io/badge/tests-326%20passed-brightgreen)

---

## Install

**Option 1: install from the Microsoft Edge Add-ons store (recommended)**

Open [the listing](https://microsoftedge.microsoft.com/addons/detail/mnedaofgbbcdgpoobimgbceabkchkaif) and click **Get** — the browser installs it and keeps it updated.

**Option 2: download the zip and load it manually**

1. Grab the latest zip from [Releases](https://github.com/ke25019/bili-title-filter/releases) and extract it somewhere permanent (not the Downloads folder, those get cleaned up)
2. Open `edge://extensions/` in Edge and turn on **Developer mode** in the bottom-left corner
3. Click **Load unpacked** and pick the extracted folder that contains `manifest.json`

On Chrome only option 2 works — same steps at `chrome://extensions/`. A manually loaded build does not auto-update, so grab a fresh zip when a release comes out.

Once it's installed, a "屏蔽助手" button shows up near Bilibili's top bar. You can drag it anywhere and it remembers where you put it.

The package ships with two locales, Simplified Chinese and English (`_locales/zh_CN`, `_locales/en`, with `__MSG_` placeholders in the manifest and `default_locale` set to `zh_CN`). Browsers and add-ons stores read exactly this configuration to decide which languages are available, so the Edge Add-ons listing offers both Chinese and English; without the `_locales` folder or `default_locale`, a store usually only sees the default one.

---

## Using it

Click the extension icon in the toolbar, or the button on the Bilibili page — both open the settings. Most of the time you only need one field: type the words you don't want to see and hit Enter. You can paste several at once, separated by commas or spaces.

There are a few matching options: case sensitivity, regular expressions, and whether the uploader's name should be matched too. Changes apply immediately — any open Bilibili tab is rescanned.

---

## Uploader whitelist

Some uploaders you want to keep no matter what their titles say — put them on the whitelist.

An entry is **the uploader's name**, exactly as the card shows it (case-insensitive), for example `某某UP主`.

Uploaders on the list are **never blocked** — keywords and category switches have no effect on them, and anything already blocked comes back immediately. You can edit the list on the settings page or straight from the in-page panel.

---

## Two ways to block

**Mask** — the cover and the title are merged into one block that says 根据您的屏蔽词已将此视频屏蔽. Hover it and the video shows up, move the pointer away and it's masked again. The text is editable.

**Hide** — the video simply isn't shown. By default I do it the way the very first version (v1.0.0) did: only the content is hidden and **the slot is kept**. That way the page doesn't reflow, and Bilibili's empty skeleton placeholders at the end of the grid don't get pulled into the middle of the feed.

If you'd rather have things compact, turn off "keep the original slot" in the panel and the card is removed from the layout entirely, with the following content moving up. Either one is fine, pick whichever you prefer.

---

## Where it applies

The settings page has two per-page switches: **in-site search results** (search.bilibili.com) is on by default, **uploader profile pages** (space.bilibili.com) is off by default. The login page (`passport.bilibili.com`) is never blocked - the links inside the login card match the promo domain rule, which used to hide the whole login panel.

---

## Blocking promoted content

Besides title keywords, you can block whole categories: live streams, anime, Chinese animation, movies, TV series, documentaries, variety shows, courses, articles, dynamics, manga, games, music, esports, merch store, events, ads.

Anime, Chinese animation, variety shows and movies are separate switches, so you can block just one of them.

There's also an "other promos" catch-all for promo cards that don't fall into any of those (app download prompts, other channel promos, and so on). It only applies when a card matches none of the specific categories — so turning "Live" off doesn't get silently re-blocked by the catch-all.

The home-page carousel has its own switch (off by default). Turning it on hides the whole block outright - it does **not** follow the mask/hide mode, because a banner is not a video card and covering it with an explanation makes no sense. It only affects that one block on the home page and is independent of the checkboxes above.

The ad slots on video pages have their own switch - "Block the ads on playback pages", **on by default**, available both in the in-page panel and on the settings page. It removes the playback page's ad slots outright - the banner below the player, the right-column ad card, the promo card in the right-hand recommendation list (measured: `.video-page-special-card-small`) and the player activity banner (measured: `.inside-wrp`) - **always removed entirely, never masked** (an explanation overlay is pointless on this page, and masks kept going wrong here). It only ever touches the slots themselves: the **player, the danmaku panel and the header are never affected**. Turn it off and the playback page goes back to exactly how it was.

I didn't hard-code a single class for detecting promo cards. The order is:

1. The category badge in the cover's top-left corner: Bilibili labels every promo card with its own category ("番剧 / 国创 / 综艺 / 电影 / 赛事…"), which is the most reliable signal
2. Without a badge, where the links inside the card point (`live.bilibili.com`, `/bangumi/play/`, `/cheese/play/`, …)
3. Known card class names (`.feed-card`, `.bili-video-card`, …)
4. Some areas use BEM naming, so elements like `bili-live-card__image--link` are resolved back to the card root
5. Otherwise it walks up to the first element that contains both a title and a cover
6. The top navigation and a few areas that hide promo links are explicitly excluded

Why the badge comes first: anime, Chinese animation, variety and movie promo cards all link to `//www.bilibili.com/bangumi/play/epXXXX` — the link alone can't tell them apart, and esports cards are usually live-stream reservations pointing at a live room. Judging by links alone meant switching "Anime" on also blocked Chinese animation, variety and movies, while the "Esports" switch did nothing at all.

When it can't tell, I'd rather skip than mess up the page, so there are safety valves: the container holds other cards, the size is over 1200×800 or 35% of the viewport, or the element has zero size — any of those and the block is skipped.

---

## The panel on the page

I didn't want to open the extension settings every time, so there's a panel inside the page. When you switch to Hide, a "keep the original slot" switch appears in it.

The panel can be dragged around; the position is stored locally and there's a "reset position" link at the bottom.

---

## Dark mode

The mask and the panel follow Bilibili's dark mode. Detection uses the `dark` attribute / `data-theme` / class names on `<html>`, with the page background brightness as a fallback. You can also force light or dark.

---

## Layout

```
bili-title-filter/
├── manifest.json          extension manifest
├── background.js          service worker: stats, badge, defaults
├── shared/defaults.js     default settings + category definitions and detection rules
├── content/
│   ├── content.js         scanning, matching, blocking, and the in-page panel
│   └── content.css        mask, hiding, dark mode
├── popup/                 toolbar popup
├── options/               full options page
├── tests/                 jsdom tests (not part of the shipped extension)
├── legacy/                archived older versions, each loadable on its own
└── icons/
```

---

## Running the tests

```bash
cd tests
npm install
npm test
```

326 checks covering the blocking logic, category detection, both hiding behaviours, the playback-page ad slots, the settings page's theme following, the settings pages and the background stats.

The mock DOM and its sizes were measured on the real site (utility-class structures like `.floor-card-inner > .cover-container + .pb-16.px-12 > p.title`, the `.vui_carousel` banner, the 0×0 hidden links inside `.palette-button-inner`, and so on).

For issues that only show up in a real browser I use the scripts in `tests/browser-harness/`, which launch a separate headless Edge — it only ever kills processes belonging to its own profile.

---

## FAQ

Not answered here? Ask in [Discussions](https://github.com/ke25019/bili-title-filter/discussions) — 使用求助 / Help for usage questions, 失效反馈 / Broken for blocking that stopped working. Bring the version, the page URL and what exactly happens, and I can reproduce it much faster.

**The README used to recommend uBlock Origin for playback-page ads — is that still needed?**
No. Back when 1.5.1–1.5.8 were trying to block them, playback-page ad blocking was unreliable (masks covering only part of the ad, collapsing into a thin line, dragging the danmaku list in, landing on the header), so it was dropped entirely and the README said "if you need playback-page blocking, that add-on is the recommended choice". **That advice is now void** — the feature has been rebuilt (see the 1.5.9 – 1.6.0 entries above): the slots are removed outright using only their own class names, with no ancestor selectors anywhere in the rule, so none of the old failures can happen, and the switch is on by default.

You are welcome to keep using uBlock Origin — the two are compatible in most scenarios — but **it is no longer needed for blocking playback-page ads**.

**I blocked a category but content from it is still visible.**
Category blocking is card-level only. When I can't tell which card holds the cover and title, I skip it, so a few unusual promo slots may be left alone. If it's the home-page carousel, use that separate switch.

**Some promo cards don't belong to any category.**
Turn on the "other promos" catch-all. It only applies when a card matches no specific category.

**Why wasn't a video blocked?**
First check that the keyword really is in the title. With case sensitivity or regex enabled, matching is stricter. You can also enable debug logging in the options and watch the console on the Bilibili tab.

**Does it slow the page down?**
Scanning uses `MutationObserver` with a 180 ms debounce and only touches cards that were added or changed. Category detection only runs while the matching switches are on, and it's rate- and count-limited.

**The counter is higher than the number of videos I saw disappear.**
Bilibili is a single-page app, so scrolling and navigating re-render cards. The counter is an approximation of blocking actions.

---

## Changelog

Newest first. This is what changed and why — including the parts I got wrong.

### 1.6.1

**Fixed: the full settings page did not follow dark mode.** The settings page's interface-appearance option says "follow Bilibili's dark mode", but the page is an extension page and cannot see Bilibili's `<html data-theme>` — it used to rely on the system preference alone, so **when Bilibili was dark and the system light, the settings page stayed white**, contradicting what the setting promises.

The content script now writes the theme it detects on a Bilibili page into `storage.local` (only on an actual change, so this is not one write every 1.2 seconds); in "follow Bilibili" mode the settings page prefers that value and falls back to the system preference only when there is none (Bilibili never opened). Switching the theme on Bilibili updates the settings page too, with no reload.

99 → 104 cases (new: the settings page going dark when Bilibili is dark, staying light when Bilibili is light, falling back to the system preference without errors when there is no record, and an explicit dark lock taking priority over the site theme; the content script gained 2 more confirming the write and the update) — **319 → 326** in total.

### 1.6.0

**Stable release: the playback-page ad blocking rebuilt across 1.5.9 – 1.5.11, now released as 1.6.0.** The code is identical to `v1.5.11-beta`; only the version number in `manifest.json` changed.

**What this release does.** The playback page's ad slots — the banner below the player, the right-column ad card, the promo card in the right-hand recommendation list and the player activity banner — are **always removed outright, never masked**, controlled by the "Block the ads on playback pages" switch (**on by default**, available in the in-page panel and on the settings page). Only the slots themselves are touched: never the player, the danmaku panel or the header. Four safety valves back this up — if any of them fails, nothing is blocked.

**Why it was rebuilt rather than patched further.** The old implementation from 1.5.1–1.5.8 worked by "recognise the ad slot → walk up to the whole card shell → cover it with a mask", which kept failing on real pages (covering only part of the ad, collapsing into a thin line, dragging the danmaku list in, landing on the header). From 1.5.9 onwards it was rebuilt on the clean 1.5.0 code: remove the slot outright using only its own class names, with no ancestor selectors anywhere in the rule, so it physically cannot spread beyond the slot. The three entries are below.

### 1.5.11 (beta)

**The promo card in the right-hand recommendation list is now part of playback-page blocking, and the in-page panel has a switch for it.**

**The promo card in the right-hand recommendation list** (measured: `.video-page-special-card-small`; ordinary recommendation cards are `.video-page-card-small`) is now handled by the playback-page switch and removed outright. There is a trap here: that class name is **already in `CARD_SELECTOR`**, so adding a CSS rule is not enough — `processCard` would treat it as an ordinary card and the "ads" category or a keyword would cover it with a mask (that `bf-blocked` seen on a real page). So `processCard` gained a "player ad slots pass straight through" test: no mask, no `bf-blocked`, and the playback-page switch removes the whole thing.

On picking the signal: the `data-v-7627ded0` Vue scope ID changes with every Bilibili build, so it is not trustworthy as the main test; "no `.upname` / `.playinfo`" and "links going to `/bubble/home/`" are kept for cross-checking, while the main test stays the class name — the `special` keyword is the most direct distinction.

**The in-page panel gained a "Block the ads on playback pages" switch** (on by default). It is the same setting as the one on the settings page, so changing either works; before this you had to open the settings page, which was inconvenient.

195 → 202 cases (new: the right-column promo card being removed outright, the panel switch existing and defaulting to on, clicking it in the panel turning it off and back on, it losing its selected state when off, the promo card not being masked while the "ads" category is on, and it not being masked when a keyword matches its title) — **312 → 319** in total.

### 1.5.10 (beta)

**1.5.9 missed the actual elements on the playback page; this release adds them.** 1.5.9 only matched `#slide_ad` / `.slide-ad-exp` — selectors I had copied from older notes and **never checked against a real page**. As a result neither the banner below the player (measured: `a.ad-report.strip-ad.left-banner`, 880×73) nor the player activity banner (measured: `.inside-wrp`) was removed, and the ad was still on screen. This release takes the measured structure from a real element inspector and adds all three:

- **The banner below the player**: `.ad-report.left-banner`
- **The right-column ad card**: `.video-card-ad-small`
- **The player activity banner**: `.inside-wrp` — the class name is far too generic to put in a CSS selector, so the script validates the structure first (both `.inside-bg` and `.hinter-msg`, or an image served from `/bfs/activity-plat/`) and only then marks it for removal

**Playback pages are now always removed outright, never masked.** An explanation overlay is pointless on this page, and masks kept going wrong here (collapsing into a thin line, covering the danmaku list, landing on the header). All four slots are now removed outright, and the "ads" category no longer turns them into masks either — landing links inside ad slots no longer take the "link matched → walk up to a card" path.

**The safety valves went from three to four**: a new one refuses to touch anything inside the header/navigation region, and if any slot fails a valve, the whole playback-page blocking is abandoned.

190 → 195 cases (new: each of the banner, the right-column card and the activity banner being removed; no mask on the activity banner; an element that looks like `.inside-wrp` but is not an activity banner left alone; and all four slots coming back when the switch is turned off) — **307 → 312** in total.

### 1.5.9 (beta)

**Playback-page blocking, rebuilt on the clean `v1.5.0-beta` code.** This release does one thing: the banner ad slot below the player on video pages (measured: `#slide_ad.slide-ad-exp`) is removed outright, and the settings page gets a dedicated switch for it, **on by default**.

**First, a correction to the record: playback-page ad blocking was not introduced in 1.5.0 — it was `v1.5.1-beta`.** I went through `content/content.js` at every tag: `v1.4.1` and **`v1.5.0-beta` contain no playback-page ad blocking at all**. The only ad-related thing in 1.5.0 is the card-detection query `querySelector('.bili-video-card__stats--ad, .bili-video-card__info--ad, .ad-report, .video-card-ad-small')`, which is how the "ads" category recognises a card — nothing to do with the playback-page ad slots. The feature first landed in `88bb422` (`fix: 播放页的广告现在能被屏蔽（1.5.1）`), and then 1.5.2–1.5.8 spent their time patching it (1.5.2 whole-card masking in the right column, 1.5.3 inline hosts and panel collapsing, 1.5.4 badge detection, 1.5.5 walking one layer too far, 1.5.6 merging two fixes from another build, 1.5.8 three rounds on a real browser), before it was removed wholesale. So this release rebuilds it on the clean 1.5.0 base instead of carrying those 2,700 lines.

**The approach: only the ad slot itself, never walk up.** Every 1.5.1–1.5.8 incident came from the same step — "recognise the ad slot by class → walk up to the whole card shell → cover it with a mask". The root cause is structural:

```
.video-pod-above-modules__inner
  ├ #danmukuBox.danmaku-box        ← danmaku panel
  ├ #slide_ad.slide-ad-exp         ← banner ad slot (this release's target)
  └ .video-card-ad-small           ← right-column ad card (belongs to the "ads" category)
```

The ad slot and the danmaku panel are **siblings under the same parent**, so any step upwards is guaranteed to hit the danmaku panel. This release therefore applies `display:none` using only the two ad-slot-specific selectors `#slide_ad` / `.slide-ad-exp`; the rule contains **no ancestor or descendant selectors at all**, so it cannot physically reach outside the ad slot. The promo slot in the site header is `.ad-report.strip-ad.left-banner`, which is not in the selector list and can never be caught. An ad slot is not a video card, so it also does **not** follow the mask/hide mode — it is removed outright, with no explanation overlay.

**Three safety valves** (following "when in doubt, don't block"): if the ad slot contains the player, the danmaku panel or the header, or matches a load sentinel, or measures more than 1200×800 or 35% of the viewport, blocking is abandoned.

**Also fixed: a bug that collapsed into a thin line on real pages.** The slot's landing link (measured: `//cm.bilibili.com/…`) matches the "ads" category href rule, so the "link matched → walk up to a card" path treated `<a class="ad-report-inner">` **itself** as a card and masked it; on a real page it is an inline element, so the mask collapsed into a thin line. That path is now excluded — and this was **reproduced by a test before it was fixed, not guessed**: `[18]` in `tests/test-content.js` was red from the start, failing with exactly `ad-report-inner bf-blocked`.

**Checks**: 172 → 190 (content script, +18), 89 → 94 (settings pages and popup, +5), 22 → 23 (background, +1) — **283 → 307** in total.

### 1.5.8

**This release was rebuilt from the `v1.5.0-beta` code base**, and adds exactly three things on top of 1.5.0: blocking the player's right-hand ad, blocking the banner ad below the player, and blocking the esports category on the home page. That claim is verifiable: I went through the diff against 1.5.0 line by line — only 6 places in 1.5.0's existing code were touched, and every one of them is an interface those three features need (`.floor-card-inner` joined the card list, badge reading gained a fallback, the badge-exclusion test was loosened, `detectType` learned synonyms, `processCard` gained an "ad slot" parameter, and the restore path passes the same parameter). Everything else is added code. In other words, every 1.5.0 feature (keywords, 18 category switches, both hiding styles, the uploader whitelist, per-page switches, the in-page panel, dark mode) is intact and unchanged.

The three things:

- **The player's right-hand ad** (the right-column ad card and promoted entries inside the danmaku list): ad slots are recognised by class (`#slide_ad`, `.slide-gg`, `.video-card-ad-small`, `.ad-report*`, `.ad-floor*`) and then walked up to the **whole ad card** — judged by having no other real card, no second ad slot (ancestors/descendants do not count, they belong to the same ad) and a size still on the scale of a card (≤600×640). When the slot itself is inline (such as `<a class="ad-report">`) it is first resolved to a block-level host, otherwise the mask collapses into a thin line; an empty placeholder (holding only `<!---->`) is skipped; and a layer that holds the danmaku list is never crossed.
- **The banner ad below the player**: the measured chain `#slide_ad.slide-ad-exp > .slide-gg > .van-slide.item-box > .item > .ad-report.link > a.ad-report-inner` is handled as one block (together with the `img.gg-pic` badge and `.close-btn`); the in-player activity banner `.inside-wrp` requires both `.inside-bg` and `.hinter-msg`, with a fallback for images served from `/bfs/activity-plat/` because Bilibili has renamed that wrapper.
- **The home-page esports category**: the `match` category now also accepts the wordings 电竞 / 比赛 / 电竞赛事 / 赛事直播 alongside the 赛事 badge, and the esports live-room path `/blanc/` joined the link rule; `.floor-card-inner` joined the card list (esports promo cards now link to ordinary videos, so link-based discovery cannot find them), backed by the "walk up from the cover badge" discovery path.

> For the record: the numbers between 1.5.0 and 1.5.7 all describe this same implementation (1.5.6 and 1.5.7 are identical in content, differing only in the number). The v1.5.6-beta / v1.5.7-beta releases were published by [@dacta-yzy](https://github.com/dacta-yzy); their additions — the danmaku list / player region protection (never collapsing a layer that holds the danmaku list during hide mode) and badge-driven discovery — are included here, and their credit stays in the contributors list below. That state is archived under `legacy/v1.5.7-beta/`.

> **This version fixes a bug (still numbered 1.5.8)**: with "ads" enabled on the video page, **the site header got covered** — the 首页 / 番剧 / 直播 / 游戏中心 entries and the message, feed and favourites icons on the right must never be touched. The cause is that the header also carries promo slots (measured: `.ad-report.strip-ad.left-banner` lives in the header), so walking up to the "whole ad card" could take the header with it; and the old exclusion classes (`.default-entry`, `.nav-link`, `.channel-entry`) **no longer exist in the current header** (measured: `.bili-header__menu` / `.bili-header__bar` / `.left-entry__item` / `.channel-link` / `.nav-search`), so the exclusion never applied. The **header / navigation / login panel** is now an "absolutely untouchable" region: keywords, category switches, ad slots, badge discovery and the shell collapse **all have to pass that gate**, and the measured header class names were added. Four new regression cases (real header structure, a promo slot inside the header, a numeric `badge` element, and hide mode) bring the suite to **341 checks**.

> **Another round of fixes (still numbered 1.5.8), this time measured in a real browser.** Once permission was granted I drove the repository's isolated instance (dedicated profile, `--disable-sync`, never touching the everyday Edge) and came back with three conclusive findings:

> 1. **One ad was being masked several times**: four ad blocks produced **twelve masks**, because `AD_SLOT_SELECTOR` matches several nested elements at once (the strip ad is `.ad-report.strip-ad.left-banner` > `.ad-report-inner`; the right-column card is `.video-card-ad-small` > `.ad-report` > `.ad-report-inner` > `.ad-floor-cover`), and every node computed its own target. Those included **degenerate "thin line" masks (888×22, 350×14)** — the inner `.ad-report-inner` measures 888×0 on the real page — which is exactly where "the mask doesn't cover properly / hover doesn't show it" came from. Only the outermost ad node is processed now, and a target must have a measurable height or we fall back to the ad slot itself. Re-measured after the fix: **three ad blocks, three masks, zero degenerate masks**.
> 2. **The header got covered**: our mask uses `z-index: 20` while the header (`.bili-header.bili-header--fixed` on video pages) has `z-index: auto`, so they are not compared in the same stacking layer — whoever comes later wins. Once the left-column strip ad (888×74, wrapped in `.left-container.scroll-sticky`) sticks to the top while scrolling, its mask paints over the navigation. The header's `z-index` is now explicitly raised above everything of ours (stacking order only, no visual change); combined with the previous release's six-path "header is untouchable" gate, the header can no longer be reached.
> 3. **One more guard around the player**: any target that contains a `<video>` or the player container is never masked or hidden (measured: pulling the player's own layer into a hide collapsed the video from 888×500 to 320×180, and Bilibili runs a "white screen" self-check that may reload the page — the likely path behind the reported "the page reloads when playback starts").

> Four new regression cases (strip ad masked only once, no degenerate masks, no per-element marking inside the right-column card, player containers never touched) bring the suite to **345 checks**.

> **This version also cut the package size by 55%** (108.4 KB → **49.2 KB**): README / AGENTS are no longer shipped (about 97 KB of pure documentation, kept in full in the repository), and packaged copies drop comments, blank lines and leading indentation while the repository sources stay untouched (those comments are the measurement record). `tools/pack.mjs` makes packaging repeatable and **validates syntax at every step** — it caught two stripping mistakes on the spot (a block-comment continuation not starting with `*`, and a comment sharing a line with its function) plus one case of binary PNG icons being rewritten as text, which kept a broken build from ever being shipped.

### 1.5.7

**The version number is unified as 1.5.7: the content is identical to the 1.5.6-beta build, only the number differs.** When 1.5.6 was published the number inside main had been reverted to 1.5.6, leaving the tag, the release asset and main each saying something different; this release unifies all three as 1.5.7, which is the number to use from now on (if you already installed 1.5.6-beta there is no need to switch — the code is the same).

The 1.5.6 entry below describes exactly this code (the two merged fixes, the two restored features and this round's layer guard).

### 1.5.6

**Two fixes from a build someone else sent over (also numbered 1.5.6, based on 1.5.2) were merged in, and the two things that build was missing are restored.** That build was based on 1.5.2 and solved two problems worth keeping:

- **Danmaku list / player region protection**: while collapsing "outer shells" in hide mode, a layer that holds the danmaku list or the player (measured: `#danmukuBox.danmaku-box`, `.video-pod-above-modules__inner`) is never collapsed upwards — the ad and the danmaku list are siblings under one parent, and without this rule hiding the ad hides the danmaku list with it.
- **Badge-driven card discovery**: alongside "known class names" and "promo link signatures", a third discovery path walks up from the cover badge. Promo cards in home-page modules such as esports link to ordinary videos or activity pages and may use unrecognised class names, so only this path reaches them (it complements 1.5.5's approach of putting `.floor-card-inner` in the card list).

That build also dropped everything done after 1.5.2, which caused two visible problems, both restored here:

- **The banner ad below the player was not blocked** (the brand creative inside `#slide_ad` and the activity banner `.inside-wrp`) — that build carried none of that code. It is restored against the measured markup: `#slide_ad.slide-ad-exp > .slide-gg > .van-slide.item-box > …`; for the activity banner both the image block `.inside-bg` and the wording line `.hinter-msg` must be present (Bilibili has renamed that wrapper, so there is a fallback for images served from `/bfs/activity-plat/`).
- **The right-column ad's mask did not cover enough** — only the ad slot itself was covered, leaving the card's title, uploader name and the "block this promo" button visible. The mask now walks up to the **whole ad card**: it stops at the outermost element that still holds only that one ad, judged by having no other real card, no second ad slot (ancestors/descendants do not count, they belong to the same ad) and a size still on the scale of a card (≤600×640 — the player's own 1130-wide layer can therefore never be taken for an ad card). When the ad slot itself is an inline element (such as `<a class="ad-report">`), it is first resolved to a block-level host, otherwise the mask collapses into a thin line and the content underneath stays visible.

- **The ad-shell collapse no longer crosses `.video-pod-above-modules`** (the regression fixed in this round): when first merged in, the region protection only listed `.video-pod-above-modules__inner`, so when that layer holds no second ad slot (an ad that has not loaded yet, for instance) the collapse kept climbing to `.video-pod-above-modules` and took the whole layer holding the danmaku list with it. That collapse now shares the same "never an empty shell" list as the card collapse, and only panel-level danmaku class names are protected (`danmaku-list` / `danmaku-panel` / `danmaku-container`) — a single danmaku item (`danmaku-item`) can still be an ad card, because a promo danmaku inside the list has to be blockable on its own.

Also: an empty ad placeholder such as `#slide_ad` (holding only a comment) is no longer covered, so no notice box appears out of nowhere; and the fixed wait in the "stats loaded" test became polling, removing a flaky false failure.

### 1.5.5

**First, a correction to 1.5.4: esports cards did not break because a badge class was renamed — I got that wrong.** The real card's outerHTML shows the actual cause: **its link became an ordinary video** (`<a href="//www.bilibili.com/video/BV1TbbC65EZ9/">`). The card lives in `.floor-card-inner`, a class name that was deliberately *not* added to the card list back then, relying instead on the generic "promo link + title + cover" detection — and that detection only ever fires for cards whose link matches some category. Once the link is a plain video, no category signal matches it, so **the card was never collected at all**: the "esports" switch did nothing, while every other category (whose links still carry a signal) kept working. The badge was healthy all along (`.badge > svg + span.floor-title` reading 赛事).

The fix: `.floor-card-inner` joined the card list (measured structure `.floor-card > .floor-card-inner`, 238×224, very stable), so these floor cards no longer depend on their link being recognisable. The badge hardening shipped in 1.5.4 (synonym class names, the 电竞/比赛 wordings, `/blanc/`, the short-cover-label fallback) stays — it addresses a different failure mode, not this one.

**The right-column ad no longer "counts the danmaku list in".** The measured shape is that `.video-pod-above-modules__inner` holds, in one layer, the danmaku list `#danmukuBox`, an **empty** ad placeholder `#slide_ad` (containing only `<!---->`) and the real ad card `.video-card-ad-small`. The previous version dropped the "stop if this layer holds another ad slot" rule so that an ad card's title layer could be reached — and that let the mask cross the parent layer and cover the danmaku list. The rule is back and written more precisely: **only ad slots that are neither ancestors nor descendants of the current slot count**, since both belong to the same ad. Measured, this stops exactly at `.video-card-ad-small`.

**Empty ad slots no longer grow a notice box**: a placeholder such as `#slide_ad` that holds nothing but a comment is now skipped (previously enabling "ads" put a "blocked by category" box over empty space).

**Diagnostics now print once per card**: the first time a card is seen it logs "badge → category → link", and an ad slot logs "judged as an ad, switch currently on/off" plus its three-level structure chain. Also, with debug on, the ad scan runs even when the "ads" switch is off and no keywords are set — otherwise the "ad recognised but switch off" diagnostic could never print, which is exactly where the report got stuck.

### 1.5.4

**Found why "esports/matches" broke a second time: Bilibili renamed the wrapper around the cover badge.** For those cards the badge is the only identity signal — their link is a live room, exactly like an ordinary live card — so when the badge could not be read, the card fell back to link-based classification, came out as "live", and the "esports" switch did nothing (that is the reported "only esports is not blocked"). The whole path is loosened now:

- **The badge wrapper's class name is no longer hard-coded**: alongside `.badge`, synonyms such as `[class*="cover-tag"]` and `[class*="corner"]` are accepted, with a final fallback — a short label (≤ 6 characters) sitting inside the cover area counts as a badge (anime / Chinese animation / variety / movie / class / live / esports are all that short).
- **Synonyms count too**: a badge reading 赛事, 电竞, 比赛, 电竞赛事 or 赛事直播 all map to the "esports" category (Bilibili has changed the wording over time), and the `/blanc/` esports live-room path joined the link rule.
- **A more subtle knock-on bug went with it**: the badge element `.floor-title` shares its name with a *title* selector. It used to be excluded only while it sat inside `.badge`, so once the wrapper was renamed the badge text was taken for the card's title, the generic detection decided "title + cover are both here" right at the cover, and **only that cover got covered** — the title and uploader name below stayed on the page. The rule "a short label on the cover is always a badge" now drives both badge reading and title exclusion, so the two can no longer disagree.

**Diagnostics got more complete.** With "output debug logs to the console" enabled on the settings page: every promo card with a cover badge logs, the first time it is seen, "badge text → which category it was judged as → where the card links", which immediately shows whether the badge, the wording or the link changed. For ad slots the log names the mask host and now also **the three-level structure chain upwards from the slot** (elements plus measured sizes), and it says so explicitly when an ad is recognised but the switch is off — previously that case left no trace whatsoever, making "not recognised" and "switch not on" impossible to tell apart.

### 1.5.3

**Promoted entries inside the danmaku list are no longer "covered by a thin line only".** The report was that the ad on the right of the player "counted the danmaku list in" and that "some pixels are still exposed above". Three separate defects came out of it:

**① The walk-up swallowed the danmaku panel.** The panel holds no video cards and stays under the size cap, so the previous two conditions could not stop it. There are more now: panel class names (`danmubox`, comment areas, recommendation feeds, the player…) halt the walk; more than 6 child elements halts it (an ad card has two or three children, a list never does); and shell elements that merely happen to match a class name no longer count as "another card".

**② What actually exposed the pixels was an inline element.** An ad slot is often just an `<a class="ad-report">` (an inline box): an absolutely positioned mask on an inline box is mispositioned, and `overflow:hidden` has no effect on inline boxes at all — so the mask collapsed into a thin line while the image and text underneath stayed visible, which is exactly the dashed line plus leaked pixels in the screenshot. The slot is now first resolved to a **block-level host**; while walking up, inline boxes (and wrappers with no measurable size) are **stepped over rather than treated as an end point** — stopping there made different nodes of the same ad chain land on different levels and produce several nested masks (I hit that during implementation; the tests went red and caught it).

**③ "The player banner never gets blocked" is fixed too.** Ad slots used to be stuck on `isNestedCard`: that check looks at whether an ancestor has *ever been processed*, and cards that were **not** blocked carry the same marker (`clearBlock` writes it as well), so once any container on the page was misidentified as a card, ad slots inside it never got their turn. Now only ancestors that are **actually covered** are skipped. Banner detection no longer hard-codes the `.right > .inside-bg` level either: it scans every `.inside-wrp` and filters by structure, with an additional fallback for images served from `/bfs/activity-plat/`.

One diagnostic aid came with it: with "output debug logs to the console" enabled on the settings page, the log names **which element is the mask host and its measured size** for every blocked ad (e.g. `广告位遮罩宿主： DIV.ad-card-wrapper 350×250`). If an ad is recognised while the "ads" switch is off, it logs `发现广告位，但「广告」开关是关的：…` — previously that case left no trace at all, making it hard to tell "not recognised" from "switch not on".

After receiving the full outerHTML of the in-player ad, the selectors and comments were aligned with what was actually measured: the real structure is `#slide_ad.slide-ad-exp > .slide-gg > .van-slide.item-box > .item > .ad-report.link > a.ad-report-inner`, plus `img.gg-pic` (the ad badge) and `.close-btn` (the close button) — `gg` is short for "advertisement" (`guanggao`) and that is Bilibili's own naming. `.slide-gg` joined the ad-slot list, and regression cases now assert that the whole block lands inside the mask host with no inner element covered separately.

### 1.5.2

**The right-column ad card is no longer only half covered.** The previous version covered the ad slot itself, but the card's title, uploader name and "ad" badge hang off an outer wrapper, so that line of text stayed on the page. The root cause: that wrapper's class name is not in any known list, and hardcoding class names is guaranteed to miss cases. The fix walks **up from the ad slot** until it reaches the outermost element that still holds only that one ad, with three conditions: no other card inside (that would mean we reached the recommendation list), no second ad slot inside, and a size still on the scale of a card (width ≤ 600, height ≤ 560). The third condition also rules out the worst case — the player's own container starts at 1130×640, so it can never be mistaken for an ad card. The wrapper's identity is no longer guessed from "it contains an ad" (which could have swallowed an entire recommendation column) but explicitly marked when it is recognised.

A knock-on bug went with it: links inside an ad slot used to go through the generic "promo link + title + cover" detection, and the list container happens to have both a title and a cover, so that ad's link was resolved all the way up to **the whole list container** and covered the entire recommendation column. Links inside ad slots are now handled by the ad scan only, and never resolved upwards by link.

**The in-player activity banner ad** is now part of the "ads" switch too. Its measured structure is `.inside-wrp > .left > .l-inside > .hinter-msg` (the wording) plus `.right > .inside-bg.clickable > .b-img > img` (image served from `/bfs/activity-plat/static/`), and those are two separate sibling nodes — matching by link or by image alone misses half of it. The rule therefore looks at structure (the image block *and* the wording line must both be present) and covers **the whole banner**: covering only the image on the right would leave the "back to school…" line sitting on the page. The class `.inside-wrp` is used by several activity slots across Bilibili, so it was not added to the card list, to avoid hitting same-named containers.

### 1.5.1

**Ads on the video page can finally be blocked.** The report was that ads on the play page stayed no matter what, and the "ads" switch seemed to do nothing — as if the whole page had been exempted. What was actually happening: the in-player ad (`#slide_ad` > `.slide-ad` > `.van-slide-item-box` > `.ad-report-link` > `a.ad-report-inner`) and the right-column ad card (`.video-card-ad-small` > `.ad-report-inner` > `a.ad-report`) are not in the known video-card class list, and an ad has **no title**, so the generic "promo link + title + cover" detection rejected both — measured: not a single one was ever collected, so they never entered the blocking pipeline at all. It had nothing to do with the per-page switches. Both slots are now recognised by class (`AD_SLOT_SELECTOR`) and classified as "ads" outright instead of guessing from links: ad cards often carry `/topic-detail` or activity-page links, and link-based matching handed them to "activity", which sits earlier in `TYPES`. Nested `.ad-report-link` / `.ad-report-inner` elements are treated as nested cards and skipped, so only one mask is created.

While I was in there, "could the play page be mistaken for an uploader's homepage?" became a regression test: the per-page switches only look at the host (`space.bilibili.com` / `search.bilibili.com`), so the play page always follows your keywords and category switches. The uploader info block on the right (`.up-info-container`) is not a card and is not caught by the "other promos" catch-all either.

### 1.5.0

**This is a beta release** (the same changes were first put together as the stable 1.4.2, but that release was never published; they ship as 1.5.0-beta instead).

**The login page is no longer blocked by the "other promos" rule** (thanks to [@ziye081220](https://github.com/ziye081220) for the report). Bilibili signs you in on `passport.bilibili.com`, and the links inside the login card matched the catch-all promo domain rule, so the whole login panel got masked as a promo. Now the login page (`passport.bilibili.com`, and any path containing `login`) is never blocked, `passport` is excluded from the catch-all domain rule, and login-related containers are excluded from card scanning.

**Two new per-page switches** (settings page, "Where it applies"):

- **In-site search results** (search.bilibili.com): **on** by default, blocking works there as before
- **Uploader profile pages** (space.bilibili.com): **off** by default - those pages are mostly the uploader's own work, so nothing is touched unless you turn it on

The login page ignores both switches and is never blocked.

### 1.4.1

**The package now declares its locales, so the store is no longer stuck on English.** Earlier builds shipped no `_locales` folder and no `default_locale` in the manifest, which meant Partner Center found no language declaration at all and offered only en-US (the v1.2.0 manifest snapshot the store keeps shows exactly that).

The package now carries `_locales/zh_CN/messages.json` and `_locales/en/messages.json`, and the manifest declares the name, description and icon tooltip through `default_locale: zh_CN` plus `__MSG_` placeholders. The store shows the matching text for the browser language, and both Simplified Chinese and English should be listed.

**The localized descriptions were shortened to fit the store limits.** The English one was too long: submitting to the Edge Add-ons store came back with "the Description for locale en exceeds the 190 character limit". Both descriptions are now under 132 characters (the stricter Chrome limit, so either store accepts them) and the names stay under 45 characters; both limits are covered by tests now.

**The Microsoft Edge Add-ons link is gone from the extension.** The settings footer now only links to the GitHub repository, so nobody lands on a stale store listing. Functionally identical to 1.4.0 - only the packaging and that one link changed.

### 1.4.0

The 1.3.x series is a stable release now. The content matches 1.3.3-beta; only the version number is 1.4.0.

**The package now declares its locales.** It ships `_locales/zh_CN` and `_locales/en`, and the manifest uses `default_locale: zh_CN` together with `__MSG_` placeholders for the name, description and icon tooltip. The Edge Add-ons store reads exactly this configuration to decide which languages it offers - with only one locale in the package, the language dropdown stays on English.

Compared with 1.2.0 this line moved promo categories to badge-based detection, fixed a batch of placeholder and leftover-box problems, added the uploader whitelist, and switched the licence to PolyForm Noncommercial 1.0.0 (no commercial use). The details are in the 1.3.3 / 1.3.2 / 1.3.1 / 1.3.0 entries below.

### 1.3.3

**The home-page top banner ad is no longer blocked.** 1.3.2 had folded the big header image (`.bili-header__banner`) into the carousel switch; this version drops that again: the switch only covers the carousel, and the header banner is left alone.

**The carousel switch now hides the whole block outright.** It used to follow the mask/hide mode, covering the banner with an explanation in mask mode. A banner is not a video card, so an explanation makes no sense - the point of turning it on is that the block should not be there. Whatever mode is active, the block is now removed entirely, including the grey wrapper and the grid slot it occupied, so the content below moves up as usual. The switch labels in the settings page, the toolbar popup and the in-page panel all say so now.

**Two links in the settings footer:** the GitHub repository and the Microsoft Edge Add-ons store, so updates are one click away.


**A whitelist bug that let things through.** Keywords match by substring, while the whitelist required an exact name - so with "某UP" as a keyword and "某UP主" on the whitelist, the card was still blocked. The whitelist now matches by substring too (case-insensitive, either direction), which also covers search-result cards whose name is written slightly differently.

**Copyright and licence notices inside the extension.** The settings footer and the toolbar popup now show `Copyright (c) 2026 ke25019` and note that the project is released under PolyForm Noncommercial 1.0.0 (noncommercial use only).

**The licence moved from Apache 2.0 to PolyForm Noncommercial 1.0.0** - no commercial use: you may use, modify and distribute the software for noncommercial purposes as long as the copyright notice stays. The `LICENSE` file, the licence sections in all three READMEs and the badge were updated together.

**A new "in-site search is not guaranteed" notice** in the disclaimer: the search results page uses a different card structure, so no promise is made that every result is blocked as expected.

### 1.3.2

**In hide mode the carousel's slot is now actually released.** 1.3.1 removed the outer `.carousel`, but measuring the real page showed that was not enough: `.recommended-swipe-body` / `.recommended-swipe-body-normal` are `position:absolute; inset:0` boxes painted with the grey `--graph_bg_regular` background, so hiding the carousel just uncovered them; and `.recommended-swipe` itself is a grid item (`grid-column:1/3`, `grid-row:1/3`) whose height comes from the inner `.shim-card` (`height:0` + `padding-top:56.25%`). Hiding only the carousel left that 2×2 cell reserved, so the videos below never moved up. Hide mode now walks up to `.recommended-swipe` and removes the whole block, so the cell is filled by the cards that follow. The safety valve is unchanged: if the wrapper holds anything besides the carousel (a loaded image, other text), the walk stops.

**That version also folded the home-page top banner ad (`.bili-header__banner`) into the same switch**; 1.3.3 removes it again on feedback - the switch only covers the carousel now.

### 1.3.1

**An uploader whitelist.** Uploaders on the list are never blocked — keywords and category switches have no effect on them, and anything already blocked comes back right away. An entry is the uploader's name, exactly as shown and case-insensitive. The settings page has a list plus bulk editing, and the in-page panel got its own row where you add entries with Enter, just like keywords.

I also removed a stray hint from the panel: it stayed visible in mask mode ("video hidden but the slot kept..."), even though that switch only means anything for the hide mode.

**The home-page carousel now follows the blocking mode.** Before, that switch did one thing: add `display:none` to `.vui_carousel`. But on the real page `.carousel`, `.carousel-container` and `.vui_carousel` are all `height:100%`, so hiding only the innermost one left an empty box behind - and it vanished without any explanation. Now **hide** mode walks up and removes the outer `.carousel` as well, so nothing is left behind, while **mask** mode covers it with an explanation: the carousel was blocked by the switch, and how to bring it back.

### 1.3.0

**Promo categories are now classified by the badge in the cover's top-left corner.** They used to be judged by the links inside the card, but two cards with identical links can belong to different categories: anime, Chinese animation, variety and movie promo cards all link to `//www.bilibili.com/bangumi/play/epXXXX`, and esports cards are usually live-stream reservations pointing at a live room. The result was that the "Anime" switch also blocked Chinese animation, variety and movies, while the "Esports" switch did nothing at all. The category name Bilibili prints on the cover now decides, and the link/class checks are the fallback.

**"Movies & TV" is now four switches, plus a new "Chinese animation" one.** The category list went from 14 to 18: live streams, anime, Chinese animation, movies, TV series, documentaries, variety shows, courses, articles, dynamics, manga, games, music, esports, merch store, events, ads, plus the "other promos" catch-all. Previously "Anime" also covered Chinese animation, variety and movies, and "Movies & TV" also covered TV series, documentaries and variety shows; each one is now its own switch.

Note: an existing "Movies & TV" setting maps to the new "Movies" only. "Anime" no longer includes Chinese animation, and TV series, documentaries and variety shows default to off — turn on the ones you want.

### 1.2.0

The 1.1.x series is a stable release now. The content matches 1.1.12-beta; only the version number is 1.2.0.

> **Note: this version has confirmed bugs and should not be used.** Promo categories were classified by link, so the "esports" switch did nothing and "anime" also blocked Chinese animation, variety shows and movies (switched to badge-based detection in 1.3.0); and hiding a card never applied to its outer container, leaving a white box behind (fixed in 1.3.3). Please upgrade.

**The outer container's hiding rules never applied.** The CSS said `.bf-blocked.bf-hide` and `.bf-blocked.bf-hide-slot`, while the outer container (the `.floor-card` box with its border, background and 40px shadow) only ever receives `bf-hide` / `bf-hide-slot` and never `bf-blocked` - the class names were applied and not a single rule matched. The card's content disappeared while the white shell stayed on the page, which is the "leftover placeholder" from the reports. Both rules are plain class selectors now: `visibility:hidden` on the element itself when the slot is kept, `display:none` when the card is removed, so the border, background, shadow and the grey layers behind it all go away.

**The category badge was treated as the video title.** The badge in the cover's top-left corner is `.badge > .floor-title`, which shares a class name with the title selectors and sits inside the cover link. Two consequences: card detection stopped right at the cover link and treated one link as a whole card, and the keyword matcher compared against the category name ("番剧") while the real title was ignored entirely. Badge text no longer counts as a title.

**Live promo cards could not be identified.** One title heuristic said a title element may not have more than 4 descendants, but a live card's title carries the "直播中" tag - `<div class="living">` wrapping a `<picture>` with two `<source>` elements and an `<img>`, plus a `<span>`, so 8 descendants - and the whole title was rejected. The limit is 12 now, based on that measurement.

**Discovering promo cards.** Candidate cards are no longer filtered by whichever category switches happen to be on (with only "live" enabled, a bangumi promo card could never be found), and promo cards inserted by lazy loading trigger a scan immediately instead of waiting for a scroll.

### 1.1.11

Following the hint, I went through the bilibili.com page source and listed everything painted with the grey placeholder colour (`--graph_bg_regular`): `.floor-card` (the one with the border and shadow), `.recommended-swipe-body` (the grey body inside the top-left block), `.layer.tiny`, `.bili-video-card__image--wrap`, `.v-img`, the various `__skeleton--*` parts, and the empty `.extension-tips-v2` slides in the banner.

All of them live inside the card containers, so the fix has to come from hiding the container together with the card. The previous attempt had a hole: **it stopped as soon as a container held more than one card**, which left the container's own grey background exposed. It now keeps walking up as long as every card inside is hidden and there is no other real content in there. The container is also re-evaluated every time, so when the second card in a container gets hidden the container follows.

While checking this I found something more important: the size safety valve was "skip anything over 1100x700 or 15% of the viewport", but the top-left two-column block measures 580x485, about 25% of the viewport - **meaning videos in that spot were never blocked at all**. The limit is now 1200x800 / 35%, which covers it while still catching the real disasters (the 1401x808 full-page container I measured).
### 1.1.10

A faint line in a tester's screenshot led me to it: Bilibili's promo cards sit inside a `.floor-card` that carries a border, a white background and a 40px shadow, while the card itself is inside it. I was only hiding the inner element, so the content disappeared but the outer box stayed — in both hiding modes.

It now walks up from the card to the outermost container that still holds only that one card and handles it too: `visibility:hidden` in keep-slot mode (border, background and shadow all go away, the slot stays), `display:none` in remove-slot mode (the whole grid item goes away, no leftover frame).

### 1.1.9

Fixing the white empty box left by the previous version. Keep-slot mode used to hide the card's **children**, so the card's own background and border stayed and it looked like an empty white box. v1.0.0 looked natural because it hid the inner card and the outer grid item has no background. It now applies `visibility:hidden` to the card itself: the slot stays, background and border vanish with it.

### 1.1.8

Went through the whole remove-slot path and fixed five things: the grid was only found via the immediate parent (missed when a card sits one level deeper), classes were cleared and re-added on every run (jitter while scrolling), placeholder detection required no `<img>` (skeletons with an unloaded image were missed), only direct children were scanned (nested empty cards were missed), and empty elements were hidden indiscriminately (could hide a height-carrying container). Also tightened the periodic re-check from 2.5s to 1.5s.

### 1.1.7

Feedback said only v1.0.0's hide mode was any good, so I ran both versions against the same real DOM and found out why: in v1.1.0 I added `.bili-feed-card` to the card selector, which changed the hiding target from "the card's content" to "the whole grid item". The grid then reflowed and the freed cells got filled with Bilibili's empty skeleton placeholders. Added the "keep the original slot" switch, defaulting to the v1.0.0 behaviour.

### 1.1.6

Fixed a bug I introduced myself: the size safety valve keyed off "is the match reason unchanged", but in hide mode a card is `display:none` (zero size), so as soon as the matching keyword changed the valve refused to process the card and it never came back when switching to Mask. Also found that `hasLayoutEngine()` cached its result permanently — if it was first called before `body` had a layout, the valve was disabled for the whole session.

### 1.1.5

Fixed grey blocks appearing in the middle of the feed in hide mode. Bilibili's grid keeps skeleton-only placeholders at the end; hiding the cards before them makes the grid pull those placeholders forward. In remove-slot mode they're now collapsed too (load sentinels are only made invisible so loading still works).

### 1.1.4

Rewrote category detection after measuring the real site in a headless Edge. Enabling "Events" used to blank the whole page — the walk-up started from a hidden 0×0 promo link, jumped three levels and landed on a 1401×808 side-button container. Promo cover and title were also being masked separately (the real cards use utility classes, not BEM). Removed the "block whole rows" feature and replaced it with a separate home-banner switch.

### 1.1.3

First attempt at filling out the category list (9 → 14, plus the catch-all) and at fixing the blank-page issue — but I fixed the wrong thing; the real cause only turned up in 1.1.4.

### 1.1.0

Category blocking did nothing before this, because it relied on class names alone. This version infers the type from the links inside the card. Also switched the mask to reveal-on-hover and made the floating button draggable.

### 1.0.0

First version: block by title keyword, two blocking styles, nine promo categories, in-page panel, dark mode.

---

## Contributors

- [@dacta-yzy](https://github.com/dacta-yzy) wrote the uploader whitelist and the home-page carousel banner blocking (v1.3.1 / v1.3.2), reported and pushed on two families of breakage (the play-page ad sharing a parent with the danmaku list, and the esports card discovery), and provided the ad-shell layer guard (v1.5.6 / v1.5.7)
- [@ziye081220](https://github.com/ziye081220) reported the login page being blocked by the promo rule (fixed in 1.5.0)

---

## License

This project is licensed under the [PolyForm Noncommercial License 1.0.0](LICENSE).

You may use, modify and distribute this software for noncommercial purposes only, provided you retain the original copyright notice. Commercial use is not permitted.

Copyright (c) 2026 ke25019

---

## Disclaimer

1. Unofficial Tool: This is a personal open-source project and is not affiliated with, authorized, or endorsed by Bilibili.
2. In-site search is not guaranteed: the search results page (search.bilibili.com) uses a slightly different card structure from the home page, so there is no promise that every result is blocked as expected - please judge by what you actually see.
3. Usage Risk: This tool modifies Bilibili's page content via script injection, which may violate Bilibili's Terms of Service regarding the prohibition of using automated scripts to access or interfere with platform content. Users should evaluate the risks themselves.
4. Data Security: This extension only reads local page data for filtering and does not collect or upload any personal information to external servers.
5. Limitation of Liability: This software is provided "as is" without any express or implied warranties. The author is not liable for any account bans, data loss, or other damages resulting from the use of this tool.
