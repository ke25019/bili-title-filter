/**
 * B站屏蔽助手 - 设置界面（popup / options）验证脚本（jsdom）
 * 用法：node test-ui.js
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const ROOT = path.join(__dirname, '..');
const DEFAULTS_SRC = fs.readFileSync(path.join(ROOT, 'shared', 'defaults.js'), 'utf8');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let pass = 0;
let fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  \u2713 ' + name); }
  else { fail++; console.log('  \u2717 ' + name + (extra !== undefined ? '  -> ' + extra : '')); }
}

/** 轮询等待条件成立，避免异步回调造成的时序抖动 */
async function waitFor(fn, timeout = 1500) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    if (fn()) return true;
    await sleep(50);
  }
  return fn();
}

function makeEnv(htmlPath, scriptRel) {
  const html = fs.readFileSync(htmlPath, 'utf8');
  const dom = new JSDOM(html, { runScripts: 'outside-only', pretendToBeVisual: true, url: 'https://example.com/' });
  const win = dom.window;
  const store = { sync: {}, local: {} };
  const errors = [];

  win.addEventListener('error', (e) => errors.push(String(e.message || e.error)));

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
      return undefined;
    },
    set(obj, cb) {
      const s = store[name] || (store[name] = {});
      Object.assign(s, obj);
      if (cb) setTimeout(cb, 0);
      return undefined;
    }
  });

  win.chrome = {
    storage: { sync: area('sync'), local: area('local'), onChanged: { addListener() {} } },
    runtime: {
      lastError: null,
      onMessage: { addListener() {} },
      sendMessage(_m, cb) { if (cb) setTimeout(() => cb({ today: 3, total: 12 }), 0); },
      openOptionsPage() {}
    }
  };
  win.confirm = () => true;
  win.URL.createObjectURL = () => 'blob:mock';
  win.URL.revokeObjectURL = () => {};

  win.eval(DEFAULTS_SRC);
  win.eval(fs.readFileSync(path.join(ROOT, scriptRel), 'utf8'));

  // 注意：不手动派发 DOMContentLoaded。
  // 页面脚本使用 ready() 助手，在 readyState 非 loading 时立即初始化，
  // 手动派发会让监听器绑定两次（正是测试脚手架曾出现的假象）。
  return { win, dom, store, errors };
}

async function testPopup() {
  console.log('\n[A] 扩展弹窗 popup');
  const { win, dom, store, errors } = makeEnv(path.join(ROOT, 'popup', 'popup.html'), 'popup/popup.js');
  const doc = win.document;
  await sleep(120);

  check('脚本执行无异常', errors.length === 0, errors.join(' | '));
  check('渲染出 14 个分区选项', doc.querySelectorAll('#types .type').length === 14, doc.querySelectorAll('#types .type').length);
  // 统计文案是通过 runtime 消息异步回调写入的，这里轮询等待，避免定时抖动
  const statsOk = await waitFor(() => /今日屏蔽 3 个/.test(doc.getElementById('stats').textContent));
  check('统计已加载', statsOk, doc.getElementById('stats').textContent);
  check('默认屏蔽方式为整体遮蔽', doc.querySelector('#mode button[data-value="mask"]').classList.contains('is-active'));

  // 添加屏蔽词
  doc.getElementById('kw-input').value = '剧透, 营销号';
  doc.getElementById('kw-add').click();
  await sleep(60);
  check('逗号分隔批量添加屏蔽词', JSON.stringify(store.sync.bfSettings.keywords) === JSON.stringify(['剧透', '营销号']),
    JSON.stringify(store.sync.bfSettings.keywords));
  check('屏蔽词以 chip 形式渲染', doc.querySelectorAll('#chips .chip').length === 2);

  // 删除
  doc.querySelector('#chips .chip__del').click();
  await sleep(60);
  check('删除屏蔽词生效', JSON.stringify(store.sync.bfSettings.keywords) === JSON.stringify(['营销号']),
    JSON.stringify(store.sync.bfSettings.keywords));

  // 切换模式
  doc.querySelector('#mode button[data-value="hide"]').click();
  await sleep(60);
  check('切换为完全隐藏模式已保存', store.sync.bfSettings.mode === 'hide', store.sync.bfSettings.mode);
  check('模式切换同步激活态', doc.querySelector('#mode button[data-value="hide"]').classList.contains('is-active'));

  // 分区屏蔽（卡片级）
  doc.querySelector('#types .type[data-key="live"]').click();
  await sleep(60);
  check('勾选屏蔽直播卡片已保存', store.sync.bfSettings.blockTypes.live === true);

  // 首页顶部轮播横幅开关
  check('存在「屏蔽首页顶部轮播横幅」开关', !!doc.getElementById('banner'));
  doc.getElementById('banner').click();
  await sleep(60);
  check('轮播横幅开关已保存', store.sync.bfSettings.blockBanner === true, JSON.stringify(store.sync.bfSettings.blockBanner));
  check('轮播横幅开关回显为开启', doc.getElementById('banner').classList.contains('is-on'));
  doc.getElementById('banner').click();
  await sleep(60);
  check('再次点击可关闭轮播横幅', store.sync.bfSettings.blockBanner === false);
  check('弹窗不再包含「整行板块」开关', !doc.getElementById('sections'));

  // 总开关
  doc.getElementById('enabled').click();
  await sleep(60);
  check('总开关可关闭', store.sync.bfSettings.enabled === false);

  dom.window.close();
}

async function testOptions() {
  console.log('\n[B] 完整设置页 options');
  const { win, dom, store, errors } = makeEnv(path.join(ROOT, 'options', 'options.html'), 'options/options.js');
  const doc = win.document;
  await sleep(120);

  check('脚本执行无异常', errors.length === 0, errors.join(' | '));
  check('分区表格渲染出 14 行', doc.querySelectorAll('#types .trow').length === 14, doc.querySelectorAll('#types .trow').length);
  check('每个分区一个「屏蔽」开关', doc.querySelectorAll('#types input[data-key]').length === 14,
    doc.querySelectorAll('#types input[data-key]').length);
  check('设置页包含「屏蔽首页顶部轮播横幅」', !!doc.getElementById('block-banner'));
  check('默认选中「整体遮蔽」', doc.querySelector('input[name="mode"][value="mask"]').checked);
  check('遮蔽文案输入框已填充默认值',
    doc.getElementById('mask-text').value === '根据您的屏蔽词已将此视频屏蔽',
    doc.getElementById('mask-text').value);
  check('预览文案与设置一致', doc.getElementById('preview-text').textContent === '根据您的屏蔽词已将此视频屏蔽');
  check('统计已加载', /累计屏蔽 12 个/.test(doc.getElementById('stats-text').textContent), doc.getElementById('stats-text').textContent);

  // 切换为完全隐藏 → 预览卡片应加上 bf-hide
  const hideRadio = doc.querySelector('input[name="mode"][value="hide"]');
  hideRadio.checked = true;
  hideRadio.dispatchEvent(new win.Event('change', { bubbles: true }));
  await sleep(60);
  check('切换隐藏模式后预览同步', doc.getElementById('preview-card').classList.contains('bf-hide'));
  check('隐藏模式已保存', store.sync.bfSettings.mode === 'hide', store.sync.bfSettings.mode);

  // 修改文案 → 预览同步
  const mt = doc.getElementById('mask-text');
  mt.value = '该视频已被你的屏蔽词挡住';
  mt.dispatchEvent(new win.Event('change', { bubbles: true }));
  await sleep(60);
  check('自定义遮蔽文案已保存', store.sync.bfSettings.maskText === '该视频已被你的屏蔽词挡住', store.sync.bfSettings.maskText);

  // 批量编辑
  doc.getElementById('kw-bulk').value = '剧透\n标题党\n\n剧透\n营销号';
  doc.getElementById('kw-bulk-save').click();
  await sleep(60);
  check('批量保存去重并忽略空行',
    JSON.stringify(store.sync.bfSettings.keywords) === JSON.stringify(['剧透', '标题党', '营销号']),
    JSON.stringify(store.sync.bfSettings.keywords));

  // 卡片全选 / 整行全选 / 全部取消
  doc.getElementById('types-all').click();
  await sleep(60);
  const all = store.sync.bfSettings.blockTypes;
  check('全选后 14 个分区均开启', Object.keys(all).length === 14 && Object.values(all).every(Boolean), JSON.stringify(all));

  // 单个分区开关
  const liveCard = doc.querySelector('#types input[data-key="live"]');
  liveCard.checked = false;
  liveCard.dispatchEvent(new win.Event('change', { bubbles: true }));
  await sleep(60);
  check('分区开关可单独关闭', store.sync.bfSettings.blockTypes.live === false);

  // 顶部轮播横幅
  const bannerBox = doc.getElementById('block-banner');
  bannerBox.checked = true;
  bannerBox.dispatchEvent(new win.Event('change', { bubbles: true }));
  await sleep(60);
  check('轮播横幅开关已保存', store.sync.bfSettings.blockBanner === true);

  doc.getElementById('types-none').click();
  await sleep(60);
  check('全部取消后所有分区均关闭', Object.values(store.sync.bfSettings.blockTypes).every((v) => !v));

  // 正则 / 大小写 / UP 主开关
  const rx = doc.getElementById('use-regex');
  rx.checked = true;
  rx.dispatchEvent(new win.Event('change', { bubbles: true }));
  await sleep(40);
  check('正则开关已保存', store.sync.bfSettings.useRegex === true);

  const up = doc.getElementById('match-up');
  up.checked = true;
  up.dispatchEvent(new win.Event('change', { bubbles: true }));
  await sleep(40);
  check('UP 主匹配开关已保存', store.sync.bfSettings.matchUpName === true);

  // 悬停展示开关
  const hv = doc.getElementById('hover-reveal');
  check('悬停展示默认开启', hv.checked === true);
  hv.checked = false;
  hv.dispatchEvent(new win.Event('change', { bubbles: true }));
  await sleep(40);
  check('悬停展示开关已保存', store.sync.bfSettings.revealOnHover === false);
  check('关闭悬停后预览卡片同步取消可悬停', !doc.getElementById('preview-card').classList.contains('bf-hoverable'));

  // 重置悬浮按钮位置
  doc.getElementById('reset-pos').click();
  await sleep(60);
  check('重置位置清空本地坐标', store.local.bfButtonPos === null, JSON.stringify(store.local.bfButtonPos));

  // 主题
  doc.querySelector('#theme button[data-value="dark"]').click();
  await sleep(60);
  check('主题切换为深色已保存', store.sync.bfSettings.theme === 'dark', store.sync.bfSettings.theme);
  check('设置页自身跟随深色主题', doc.documentElement.getAttribute('data-theme') === 'dark');

  // 恢复默认
  doc.getElementById('reset-all').click();
  await sleep(60);
  const s = store.sync.bfSettings;
  check('恢复默认设置：屏蔽词清空', s.keywords.length === 0);
  check('恢复默认设置：模式回到 mask', s.mode === 'mask', s.mode);

  dom.window.close();
}

async function main() {
  await testPopup();
  await testOptions();
  console.log('\n========================================');
  console.log('通过 ' + pass + ' 项，失败 ' + fail + ' 项');
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(2); });
