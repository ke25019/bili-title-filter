/**
 * B站屏蔽助手 - 后台 Service Worker 验证（vm 模拟 SW 环境）
 * 用法：node test-background.js
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const DEFAULTS_SRC = fs.readFileSync(path.join(ROOT, 'shared', 'defaults.js'), 'utf8');
const BACKGROUND_SRC = fs.readFileSync(path.join(ROOT, 'background.js'), 'utf8');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 轮询等待条件成立，避免机器负载导致的时序抖动 */
async function waitFor(fn, timeout = 3000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    if (fn()) return true;
    await sleep(30);
  }
  return fn();
}

let pass = 0;
let fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  \u2713 ' + name); }
  else { fail++; console.log('  \u2717 ' + name + (extra !== undefined ? '  -> ' + extra : '')); }
}

async function main() {
  const store = { sync: {}, local: {} };
  const badge = { text: null, color: null, title: null };
  const messageListeners = [];
  const installedListeners = [];
  const storageChangedListeners = [];

  function pick(s, keys) {
    const out = {};
    if (typeof keys === 'string') { if (keys in s) out[keys] = s[keys]; return out; }
    if (Array.isArray(keys)) { keys.forEach((k) => { if (k in s) out[k] = s[k]; }); return out; }
    return Object.assign({}, s);
  }
  const area = (name) => ({
    get(keys, cb) {
      const s = store[name] || (store[name] = {});
      const res = keys ? pick(s, keys) : Object.assign({}, s);
      if (cb) setTimeout(() => cb(res), 0);
      return Promise.resolve(res);
    },
    set(obj, cb) {
      const s = store[name] || (store[name] = {});
      Object.assign(s, obj);
      if (cb) setTimeout(cb, 0);
      return Promise.resolve();
    }
  });

  const sandbox = {
    console,
    setTimeout,
    clearTimeout,
    Date,
    Number,
    Object,
    JSON,
    Promise,
    String,
    Array,
    importScripts(rel) {
      const p = path.join(ROOT, rel.replace(/^\//, ''));
      vm.runInContext(fs.readFileSync(p, 'utf8'), context);
    },
    chrome: {
      storage: {
        sync: area('sync'),
        local: area('local'),
        onChanged: { addListener: (fn) => storageChangedListeners.push(fn) }
      },
      runtime: {
        onInstalled: { addListener: (fn) => installedListeners.push(fn) },
        onStartup: { addListener: () => {} },
        onMessage: { addListener: (fn) => messageListeners.push(fn) },
        openOptionsPage: () => { sandbox.__optionsOpened = true; }
      },
      action: {
        setBadgeText: (o) => { badge.text = o.text; return Promise.resolve(); },
        setBadgeBackgroundColor: (o) => { badge.color = o.color; return Promise.resolve(); },
        setTitle: (o) => { badge.title = o.title; return Promise.resolve(); }
      }
    }
  };
  sandbox.self = sandbox;
  sandbox.globalThis = sandbox;

  const context = vm.createContext(sandbox);
  vm.runInContext(BACKGROUND_SRC, context);

  await sleep(120);

  console.log('\n[后台 Service Worker]');
  check('默认配置已写入 storage.sync', !!store.sync.bfSettings, JSON.stringify(store.sync.bfSettings));
  check('默认屏蔽方式为 mask', store.sync.bfSettings.mode === 'mask');
  check('默认 18 个分区开关均为关闭',
    Object.keys(store.sync.bfSettings.blockTypes).length === 18 &&
    Object.values(store.sync.bfSettings.blockTypes).every((v) => v === false));
  check('默认不屏蔽首页顶部轮播横幅', store.sync.bfSettings.blockBanner === false);
  check('默认在搜索结果页屏蔽、在 UP 个人主页不屏蔽',
    store.sync.bfSettings.blockOnSearch === true && store.sync.bfSettings.blockOnSpace === false,
    store.sync.bfSettings.blockOnSearch + '/' + store.sync.bfSettings.blockOnSpace);
  check('默认 UP 白名单为空',
    Array.isArray(store.sync.bfSettings.whitelist) && store.sync.bfSettings.whitelist.length === 0,
    JSON.stringify(store.sync.bfSettings.whitelist));
  check('已移除旧的「整行板块」配置项', !('blockSections' in store.sync.bfSettings));
  check('统计数据已初始化', !!store.local.bfStats, JSON.stringify(store.local.bfStats));

  // 模拟内容脚本上报屏蔽数量
  const send = (msg) => new Promise((resolve) => {
    let done = false;
    messageListeners.forEach((fn) => fn(msg, {}, (r) => { done = true; resolve(r); }));
    setTimeout(() => { if (!done) resolve(undefined); }, 100);
  });

  await send({ type: 'BF_STATS', delta: 3 });
  check('累加屏蔽数量到 total', await waitFor(() => store.local.bfStats.total === 3), store.local.bfStats.total);
  check('今日屏蔽数量正确', await waitFor(() => store.local.bfStats.today === 3), store.local.bfStats.today);
  // 徽标是通过 storage 变更回调异步更新的，轮询等待，避免机器负载下的时序抖动
  check('徽标显示今日数量', await waitFor(() => badge.text === '3'), JSON.stringify(badge.text));
  check('徽标颜色为 B 站蓝', badge.color === '#00aeec', badge.color);
  check('图标悬浮提示包含数量', await waitFor(() => /今日已屏蔽 3 个/.test(badge.title || '')), JSON.stringify(badge.title));

  await send({ type: 'BF_STATS', delta: 5 });
  await sleep(80);
  check('多次累加正确', store.local.bfStats.total === 8 && store.local.bfStats.today === 8,
    store.local.bfStats.total + '/' + store.local.bfStats.today);

  await send({ type: 'BF_STATS', delta: 0 });
  await sleep(50);
  check('delta=0 不改变统计', store.local.bfStats.total === 8);

  const stats = await send({ type: 'BF_GET_STATS' });
  check('BF_GET_STATS 返回统计', !!stats && stats.total === 8 && stats.today === 8, JSON.stringify(stats));

  await send({ type: 'BF_OPEN_OPTIONS' });
  await sleep(50);
  check('BF_OPEN_OPTIONS 会打开设置页', sandbox.__optionsOpened === true);

  await send({ type: 'BF_RESET_STATS' });
  await sleep(80);
  check('重置统计后清零', store.local.bfStats.total === 0 && store.local.bfStats.today === 0,
    JSON.stringify(store.local.bfStats));
  check('重置后徽标清空', badge.text === '', JSON.stringify(badge.text));

  // 统计存储变化会刷新徽标
  store.local.bfStats = { total: 20, today: 7, date: store.local.bfStats.date };
  storageChangedListeners.forEach((fn) => fn({ bfStats: { newValue: store.local.bfStats } }, 'local'));
  await sleep(50);
  check('统计变化时徽标同步更新', badge.text === '7', badge.text);

  // 超大数字截断
  store.local.bfStats = { total: 2000, today: 1500, date: store.local.bfStats.date };
  storageChangedListeners.forEach((fn) => fn({ bfStats: { newValue: store.local.bfStats } }, 'local'));
  await sleep(50);
  check('超过 999 显示 999+', badge.text === '999+', badge.text);

  // onInstalled 会补齐默认值
  store.sync.bfSettings = undefined;
  installedListeners.forEach((fn) => fn({ reason: 'install' }));
  await sleep(120);
  check('安装事件会补齐默认配置', !!store.sync.bfSettings && store.sync.bfSettings.mode === 'mask');

  console.log('\n========================================');
  console.log('通过 ' + pass + ' 项，失败 ' + fail + ' 项');
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(2); });
