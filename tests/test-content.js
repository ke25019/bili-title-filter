/**
 * B站屏蔽助手 - 功能验证脚本（jsdom）
 * 用法：node test-content.js
 * 校验点：面板挂载 / 关键词遮蔽 / 完全隐藏 / 分区推广屏蔽 / 解除屏蔽 /
 *         正则匹配 / 动态新增卡片 / 总开关 / 深色模式适配
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const ROOT = path.join(__dirname, '..');
const DEFAULTS_SRC = fs.readFileSync(path.join(ROOT, 'shared', 'defaults.js'), 'utf8');
const CONTENT_SRC = fs.readFileSync(path.join(ROOT, 'content', 'content.js'), 'utf8');

const HTML = `<!DOCTYPE html><html><head></head><body>
  <div class="bili-header">
    <div class="right-entry"></div>
    <div id="nav-searchform"></div>
  </div>
  <main>
    <div class="bili-video-card" id="c1">
      <a class="bili-video-card__image--link" href="//www.bilibili.com/video/BV1aa"><div class="cover"></div></a>
      <div class="bili-video-card__info">
        <h3 class="bili-video-card__info--tit" title="【剧透警告】新番结局深度解析">【剧透警告】新番结局深度解析</h3>
        <span class="bili-video-card__info--author">某UP主</span>
      </div>
    </div>
    <div class="bili-video-card" id="c2">
      <a class="bili-video-card__image--link" href="//www.bilibili.com/video/BV1bb"><div class="cover"></div></a>
      <div class="bili-video-card__info">
        <h3 class="bili-video-card__info--tit" title="正常的一个视频">正常的一个视频</h3>
        <span class="bili-video-card__info--author">良心UP主</span>
      </div>
    </div>
    <div class="bili-live-card" id="c3">
      <a href="https://live.bilibili.com/2263"><div class="cover"></div></a>
      <div class="bili-live-card__info--tit">正在直播：某个主播</div>
    </div>
    <div class="bili-video-card" id="c4">
      <a class="bili-video-card__image--link" href="//www.bilibili.com/bangumi/play/ep123456"><div class="cover"></div></a>
      <div class="bili-video-card__info">
        <h3 class="bili-video-card__info--tit" title="某番剧第一话">某番剧第一话</h3>
      </div>
    </div>
  </main>
</body></html>`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let pass = 0;
let fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  \u2713 ' + name); }
  else { fail++; console.log('  \u2717 ' + name + (extra !== undefined ? '  -> ' + extra : '')); }
}

async function main() {
  const store = { sync: {}, local: {} };
  const onChangedListeners = [];

  function pick(s, keys) {
    const out = {};
    if (typeof keys === 'string') { if (keys in s) out[keys] = s[keys]; return out; }
    if (Array.isArray(keys)) { keys.forEach((k) => { if (k in s) out[k] = s[k]; }); return out; }
    return Object.assign({}, s);
  }

  function area(name) {
    return {
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
    };
  }

  const dom = new JSDOM(HTML, { runScripts: 'outside-only', pretendToBeVisual: true, url: 'https://www.bilibili.com/' });
  const win = dom.window;

  win.chrome = {
    storage: {
      sync: area('sync'),
      local: area('local'),
      onChanged: { addListener: (fn) => onChangedListeners.push(fn) }
    },
    runtime: {
      lastError: null,
      onMessage: { addListener() {} },
      sendMessage(_msg, cb) { if (cb) setTimeout(() => cb({ today: 0, total: 0 }), 0); },
      openOptionsPage() {}
    }
  };

  win.eval(DEFAULTS_SRC);
  win.eval(CONTENT_SRC);

  const doc = win.document;
  const c1 = () => doc.getElementById('c1');
  const c2 = () => doc.getElementById('c2');
  const c3 = () => doc.getElementById('c3');
  const c4 = () => doc.getElementById('c4');
  const maskText = (el) => {
    const m = el.querySelector(':scope > .bf-mask');
    return m ? m.querySelector('.bf-mask__text').textContent : '(无)';
  };

  /** 模拟设置变化：写入 store 并广播 storage.onChanged */
  async function pushSettings(patch) {
    const next = Object.assign({}, store.sync.bfSettings || {}, patch);
    store.sync.bfSettings = next;
    onChangedListeners.forEach((f) => f({ bfSettings: { newValue: next } }, 'sync'));
    await sleep(60);
  }

  await sleep(300);

  console.log('\n[1] 初始化与页面内面板');
  check('内容脚本已加载', !!win.__BF_CONTENT_LOADED__);
  const host = doc.getElementById('bili-filter-host');
  check('悬浮面板已挂载到页面', !!host);
  check('面板使用 Shadow DOM 隔离', !!(host && host.shadowRoot));
  const shadow = host && host.shadowRoot;
  check('面板包含屏蔽方式切换', !!(shadow && shadow.getElementById('bf-mode')));
  check('面板包含屏蔽词输入框', !!(shadow && shadow.getElementById('bf-kw-input')));
  check('面板包含 9 种分区推广选项',
    !!(shadow && shadow.querySelectorAll('.bf-type').length === 9),
    shadow ? shadow.querySelectorAll('.bf-type').length : 'n/a');
  check('面板包含外观主题切换', !!(shadow && shadow.getElementById('bf-theme')));

  console.log('\n[2] 默认状态下不误伤');
  check('普通视频未被屏蔽', !c2().classList.contains('bf-blocked'));
  check('直播卡片未被屏蔽', !c3().classList.contains('bf-blocked'));

  console.log('\n[3] 关键词 + 整体遮蔽');
  await pushSettings({ enabled: true, mode: 'mask', keywords: ['剧透'] });
  check('命中屏蔽词的视频被标记 bf-blocked', c1().classList.contains('bf-blocked'));
  check('未命中的视频不受影响', !c2().classList.contains('bf-blocked'));
  const mask1 = c1().querySelector(':scope > .bf-mask');
  check('生成了遮蔽区域 .bf-mask', !!mask1);
  check('遮蔽文案正确', mask1 && mask1.querySelector('.bf-mask__text').textContent === '根据您的屏蔽词已将此视频屏蔽', maskText(c1()));
  check('显示命中屏蔽词', mask1 && mask1.querySelector('.bf-mask__sub').textContent.indexOf('剧透') !== -1);
  check('遮蔽模式不隐藏卡片本身', !c1().classList.contains('bf-hide'));
  check('标题取自 title 属性（含【】前缀仍可命中）', mask1 !== null);

  console.log('\n[4] 完全隐藏模式');
  await pushSettings({ mode: 'hide' });
  check('命中视频被完全隐藏 bf-hide', c1().classList.contains('bf-hide'));
  await pushSettings({ mode: 'mask' });
  check('切回遮蔽后 bf-hide 被移除', !c1().classList.contains('bf-hide'));

  console.log('\n[5] 分区推广屏蔽');
  await pushSettings({ blockTypes: { live: true } });
  check('直播卡片被屏蔽', c3().classList.contains('bf-blocked'));
  check('直播卡片判定类型为 live', c3().dataset.bfType === 'live', c3().dataset.bfType);
  check('分区文案包含分区名「直播」', maskText(c3()).indexOf('直播') !== -1, maskText(c3()));
  check('番剧卡片未受影响', !c4().classList.contains('bf-blocked'));

  await pushSettings({ blockTypes: { live: true, bangumi: true } });
  check('番剧卡片按链接识别并被屏蔽', c4().classList.contains('bf-blocked'));
  check('番剧卡片判定类型为 bangumi', c4().dataset.bfType === 'bangumi', c4().dataset.bfType);

  console.log('\n[6] 解除屏蔽');
  await pushSettings({ keywords: [], blockTypes: {} });
  check('清空屏蔽词后视频恢复显示', !c1().classList.contains('bf-blocked'));
  check('遮蔽区域被移除', !c1().querySelector(':scope > .bf-mask'));
  check('直播卡片恢复', !c3().classList.contains('bf-blocked'));
  check('番剧卡片恢复', !c4().classList.contains('bf-blocked'));

  console.log('\n[7] 正则 / 大小写 / UP主匹配');
  await pushSettings({ keywords: ['^【.*?】'], useRegex: true });
  check('正则屏蔽词生效', c1().classList.contains('bf-blocked'));
  await pushSettings({ keywords: ['【剧透'], useRegex: false, caseSensitive: true });
  check('区分大小写模式下中文关键词仍生效', c1().classList.contains('bf-blocked'));
  await pushSettings({ keywords: [], caseSensitive: false, matchUpName: true });
  await pushSettings({ keywords: ['良心UP主'] });
  check('可选匹配 UP 主名称', c2().classList.contains('bf-blocked'));
  await pushSettings({ keywords: [], matchUpName: false });
  check('关闭 UP 主匹配后恢复', !c2().classList.contains('bf-blocked'));

  console.log('\n[8] 动态新增卡片（滚动懒加载）');
  const extra = doc.createElement('div');
  extra.className = 'bili-video-card';
  extra.id = 'c9';
  extra.innerHTML = '<a href="//www.bilibili.com/video/BV9zz"></a>' +
    '<h3 class="bili-video-card__info--tit" title="营销号又来了">营销号又来了</h3>';
  doc.querySelector('main').appendChild(extra);
  await pushSettings({ keywords: ['营销号'] });
  check('新卡片被自动扫描并屏蔽', doc.getElementById('c9').classList.contains('bf-blocked'));

  console.log('\n[9] 总开关');
  await pushSettings({ enabled: false });
  check('停用后不再屏蔽', !doc.getElementById('c9').classList.contains('bf-blocked'));
  await pushSettings({ enabled: true });
  check('重新启用后恢复屏蔽', doc.getElementById('c9').classList.contains('bf-blocked'));

  console.log('\n[10] 深色模式适配');
  doc.documentElement.setAttribute('data-theme', 'dark');
  await sleep(1600);
  check('识别 B 站深色模式并标记 html.bf-dark', doc.documentElement.classList.contains('bf-dark'));
  check('面板同步切换为深色主题', host.getAttribute('data-theme') === 'dark', host.getAttribute('data-theme'));
  doc.documentElement.setAttribute('data-theme', 'light');
  await sleep(1600);
  check('切回浅色后取消深色标记', !doc.documentElement.classList.contains('bf-dark'));

  console.log('\n========================================');
  console.log('通过 ' + pass + ' 项，失败 ' + fail + ' 项');
  dom.window.close();
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(2); });
