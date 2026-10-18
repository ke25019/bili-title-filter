/**
 * B站屏蔽助手 - 后台 Service Worker
 * 负责：默认配置初始化、屏蔽统计、工具栏徽标、打开设置页
 */
importScripts('shared/defaults.js');

const STATS_KEY = 'bfStats';

function todayStr() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

function getStats() {
  return new Promise((resolve) => {
    chrome.storage.local.get(STATS_KEY, (v) => {
      const s = (v && v[STATS_KEY]) || {};
      const today = todayStr();
      resolve({
        total: Number(s.total) || 0,
        today: s.date === today ? Number(s.today) || 0 : 0,
        date: today
      });
    });
  });
}

async function addStats(delta) {
  if (!delta) return;
  const s = await getStats();
  s.total += delta;
  s.today += delta;
  s.date = todayStr();
  await new Promise((resolve) => chrome.storage.local.set({ [STATS_KEY]: s }, resolve));
  updateBadge(s);
}

function updateBadge(stats) {
  const n = stats ? stats.today : 0;
  const text = n <= 0 ? '' : n > 999 ? '999+' : String(n);
  chrome.action.setBadgeText({ text }).catch(() => {});
  chrome.action.setBadgeBackgroundColor({ color: '#00aeec' }).catch(() => {});
  if (n > 0) {
    chrome.action.setTitle({ title: `B站屏蔽助手 · 今日已屏蔽 ${n} 个` }).catch(() => {});
  } else {
    chrome.action.setTitle({ title: 'B站屏蔽助手' }).catch(() => {});
  }
}

async function ensureDefaults() {
  const v = await new Promise((resolve) => chrome.storage.sync.get('bfSettings', resolve));
  const normalized = bfNormalize(v && v.bfSettings);
  if (!v || !v.bfSettings) {
    await new Promise((resolve) => chrome.storage.sync.set({ bfSettings: normalized }, resolve));
  }
  const stats = await getStats();
  await new Promise((resolve) => chrome.storage.local.set({ [STATS_KEY]: stats }, resolve));
  updateBadge(stats);
}

chrome.runtime.onInstalled.addListener(() => {
  ensureDefaults();
});

chrome.runtime.onStartup.addListener(() => {
  ensureDefaults();
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || !msg.type) return;

  if (msg.type === 'BF_STATS') {
    addStats(Number(msg.delta) || 0);
    sendResponse({ ok: true });
    return true;
  }

  if (msg.type === 'BF_GET_STATS') {
    getStats().then((s) => sendResponse(s));
    return true;
  }

  if (msg.type === 'BF_RESET_STATS') {
    const empty = { total: 0, today: 0, date: todayStr() };
    chrome.storage.local.set({ [STATS_KEY]: empty }, () => {
      updateBadge(empty);
      sendResponse({ ok: true });
    });
    return true;
  }

  if (msg.type === 'BF_OPEN_OPTIONS') {
    chrome.runtime.openOptionsPage();
    sendResponse({ ok: true });
    return true;
  }

  return undefined;
});

// 设置变化时通知所有 B 站标签页重新扫描（内容脚本自身也会监听 storage）
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes[STATS_KEY]) {
    updateBadge(changes[STATS_KEY].newValue || {});
  }
});

ensureDefaults();
