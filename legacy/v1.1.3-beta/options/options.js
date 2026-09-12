/** B站屏蔽助手 - 完整设置页 */
(function () {
  'use strict';

  var settings = window.bfNormalize(null);
  var TYPES = window.BF_TYPES;

  function $(id) { return document.getElementById(id); }

  /** DOM 就绪后执行（若脚本被延迟加载，则立即执行） */
  function ready(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn, { once: true });
    } else {
      fn();
    }
  }

  function toast(msg) {
    var el = $('toast');
    el.textContent = msg;
    el.classList.add('is-show');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { el.classList.remove('is-show'); }, 1800);
  }

  function getSettings() {
    return new Promise(function (resolve) {
      chrome.storage.sync.get('bfSettings', function (v) {
        resolve(window.bfNormalize(v && v.bfSettings));
      });
    });
  }

  function save(patch, silent) {
    settings = window.bfNormalize(Object.assign({}, settings, patch));
    chrome.storage.sync.set({ bfSettings: settings });
    render();
    if (!silent) toast('已保存');
  }

  /* ---------------- 渲染 ---------------- */

  function applyPageTheme() {
    var t = settings.theme;
    if (t === 'auto') {
      var dark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    } else {
      document.documentElement.setAttribute('data-theme', t);
    }
  }

  function render() {
    $('enabled').classList.toggle('is-on', !!settings.enabled);
    $('enabled').setAttribute('aria-checked', settings.enabled ? 'true' : 'false');
    $('enabled-text').textContent = settings.enabled ? '已启用' : '已停用';

    Array.prototype.forEach.call(document.querySelectorAll('input[name="mode"]'), function (r) {
      r.checked = r.value === settings.mode;
    });

    $('mask-text').value = settings.maskText;
    $('type-mask-text').value = settings.typeMaskText;
    $('hover-reveal').checked = !!settings.revealOnHover;

    $('case-sensitive').checked = !!settings.caseSensitive;
    $('use-regex').checked = !!settings.useRegex;
    $('match-up').checked = !!settings.matchUpName;

    $('show-btn').checked = !!settings.showHeaderButton;
    $('debug').checked = !!settings.debug;

    Array.prototype.forEach.call(document.querySelectorAll('#theme button'), function (b) {
      b.classList.toggle('is-active', b.dataset.value === settings.theme);
    });

    renderKeywords();
    renderTypes();
    renderPreview();
    applyPageTheme();
  }

  function renderKeywords() {
    var chips = $('chips');
    chips.innerHTML = '';
    if (!settings.keywords.length) {
      var empty = document.createElement('div');
      empty.className = 'empty';
      empty.textContent = '还没有屏蔽词。添加后会在所有已打开的 B 站页面立即生效。';
      chips.appendChild(empty);
      return;
    }
    settings.keywords.forEach(function (kw, i) {
      var chip = document.createElement('span');
      chip.className = 'chip';
      var t = document.createElement('span');
      t.className = 'chip__text';
      t.textContent = kw;
      t.title = kw;
      var del = document.createElement('button');
      del.className = 'chip__del';
      del.type = 'button';
      del.textContent = '✕';
      del.title = '删除';
      del.addEventListener('click', function () {
        var list = settings.keywords.slice();
        list.splice(i, 1);
        save({ keywords: list });
      });
      chip.appendChild(t);
      chip.appendChild(del);
      chips.appendChild(chip);
    });
  }

  function makeTypeCell(t, scope) {
    var label = document.createElement('label');
    label.className = 'tcell';
    var input = document.createElement('input');
    input.type = 'checkbox';
    input.dataset.key = t.key;
    input.dataset.scope = scope;
    var span = document.createElement('span');
    span.textContent = scope === 'card' ? '卡片' : '整行';
    label.appendChild(input);
    label.appendChild(span);

    input.addEventListener('change', function () {
      if (scope === 'card') {
        var next = Object.assign({}, settings.blockTypes);
        next[t.key] = input.checked;
        save({ blockTypes: next }, true);
      } else {
        var nextS = Object.assign({}, settings.blockSections);
        nextS[t.key] = input.checked;
        save({ blockSections: nextS }, true);
      }
      toast(input.checked ? '已屏蔽「' + t.label + '」' + (scope === 'card' ? '卡片' : '整行板块')
                          : '已恢复显示「' + t.label + '」' + (scope === 'card' ? '卡片' : '整行板块'));
    });
    return label;
  }

  function renderTypes() {
    var box = $('types');
    if (!box.dataset.built) {
      var head = document.createElement('div');
      head.className = 'typetable__head';
      var h1 = document.createElement('span');
      h1.textContent = '分区';
      var h2 = document.createElement('span');
      h2.textContent = '屏蔽卡片';
      var h3 = document.createElement('span');
      h3.textContent = '整行板块';
      head.appendChild(h1);
      head.appendChild(h2);
      head.appendChild(h3);
      box.appendChild(head);

      TYPES.forEach(function (t) {
        var row = document.createElement('div');
        row.className = 'trow';

        var name = document.createElement('div');
        var label = document.createElement('span');
        label.className = 'trow__name';
        label.textContent = t.label;
        var desc = document.createElement('span');
        desc.className = 'trow__desc';
        desc.textContent = t.desc;
        name.appendChild(label);
        name.appendChild(desc);

        row.appendChild(name);
        row.appendChild(makeTypeCell(t, 'card'));
        row.appendChild(makeTypeCell(t, 'section'));
        box.appendChild(row);
      });
      box.dataset.built = '1';
    }
    syncTypes();
  }

  function syncTypes() {
    Array.prototype.forEach.call(document.querySelectorAll('#types input[data-scope]'), function (input) {
      var k = input.dataset.key;
      var on = input.dataset.scope === 'card' ? !!settings.blockTypes[k] : !!settings.blockSections[k];
      input.checked = on;
      var cell = input.closest('.tcell');
      if (cell) cell.classList.toggle('is-on', on);
    });
  }

  function renderPreview() {
    var card = $('preview-card');
    card.classList.toggle('bf-hide', settings.mode === 'hide');
    card.classList.toggle('bf-hoverable', !!settings.revealOnHover);
    $('preview-text').textContent = settings.maskText || window.BF_DEFAULTS.maskText;
    var hint = card.querySelector('.bf-mask__hint');
    if (hint) hint.style.display = settings.revealOnHover ? 'block' : 'none';
  }

  /* ---------------- 统计 ---------------- */

  function loadStats() {
    chrome.runtime.sendMessage({ type: 'BF_GET_STATS' }, function (s) {
      if (chrome.runtime.lastError || !s) return;
      $('stats-text').textContent = '今日屏蔽 ' + s.today + ' 个 · 累计屏蔽 ' + s.total + ' 个';
    });
  }

  /* ---------------- 事件 ---------------- */

  function addKeywordFromInput() {
    var input = $('kw-input');
    var raw = (input.value || '').trim();
    if (!raw) return;
    var parts = settings.useRegex ? [raw] : raw.split(/[,，、;；\s]+/);
    var list = settings.keywords.slice();
    var added = 0;
    parts.forEach(function (p) {
      var v = p.trim();
      if (v && list.indexOf(v) === -1) { list.push(v); added++; }
    });
    input.value = '';
    if (added) save({ keywords: list }, true);
    toast(added ? '已添加 ' + added + ' 个屏蔽词' : '这些屏蔽词已存在');
  }

  function bind() {
    $('enabled').addEventListener('click', function () {
      save({ enabled: !settings.enabled }, true);
      toast(settings.enabled ? '已启用屏蔽' : '已停用屏蔽');
    });

    Array.prototype.forEach.call(document.querySelectorAll('input[name="mode"]'), function (r) {
      r.addEventListener('change', function () {
        if (r.checked) save({ mode: r.value }, true);
      });
    });

    $('mask-text').addEventListener('change', function () { save({ maskText: $('mask-text').value }); });
    $('type-mask-text').addEventListener('change', function () { save({ typeMaskText: $('type-mask-text').value }); });
    $('hover-reveal').addEventListener('change', function () { save({ revealOnHover: $('hover-reveal').checked }, true); });
    $('case-sensitive').addEventListener('change', function () { save({ caseSensitive: $('case-sensitive').checked }, true); });
    $('use-regex').addEventListener('change', function () { save({ useRegex: $('use-regex').checked }, true); });
    $('match-up').addEventListener('change', function () { save({ matchUpName: $('match-up').checked }, true); });
    $('show-btn').addEventListener('change', function () { save({ showHeaderButton: $('show-btn').checked }, true); });
    $('debug').addEventListener('change', function () { save({ debug: $('debug').checked }, true); });

    $('kw-add').addEventListener('click', addKeywordFromInput);
    $('kw-input').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); addKeywordFromInput(); }
    });

    $('kw-bulk-load').addEventListener('click', function () {
      $('kw-bulk').value = settings.keywords.join('\n');
      toast('已载入当前列表');
    });

    $('kw-bulk-save').addEventListener('click', function () {
      var raw = $('kw-bulk').value || '';
      var list = raw.split(/\r?\n/).map(function (s) { return s.trim(); }).filter(Boolean);
      var uniq = [];
      list.forEach(function (v) { if (uniq.indexOf(v) === -1) uniq.push(v); });
      save({ keywords: uniq }, true);
      $('kw-bulk').value = '';
      toast('已保存 ' + uniq.length + ' 个屏蔽词');
    });

    $('types-all').addEventListener('click', function () {
      var next = {};
      TYPES.forEach(function (t) { next[t.key] = true; });
      save({ blockTypes: next }, true);
      toast('已屏蔽全部分区的卡片');
    });

    $('sections-all').addEventListener('click', function () {
      var nextS = {};
      TYPES.forEach(function (t) { nextS[t.key] = true; });
      save({ blockSections: nextS }, true);
      toast('已屏蔽全部分区的整行板块');
    });

    $('types-none').addEventListener('click', function () {
      save({ blockTypes: {}, blockSections: {} }, true);
      toast('已恢复显示全部分区');
    });

    $('reset-pos').addEventListener('click', function () {
      chrome.storage.local.set({ bfButtonPos: null }, function () {
        void chrome.runtime.lastError;
        save({ buttonPos: null }, true);
        toast('悬浮按钮位置已重置，回到标题栏右侧');
      });
    });

    $('theme').addEventListener('click', function (e) {
      var b = e.target.closest('button[data-value]');
      if (b) save({ theme: b.dataset.value }, true);
    });

    $('reset-stats').addEventListener('click', function () {
      chrome.runtime.sendMessage({ type: 'BF_RESET_STATS' }, function () {
        void chrome.runtime.lastError;
        loadStats();
        toast('统计已重置');
      });
    });

    $('export').addEventListener('click', function () {
      var data = JSON.stringify({ app: 'bili-blocker', version: 1, settings: settings }, null, 2);
      var blob = new Blob([data], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'bili-blocker-settings.json';
      a.click();
      setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
      toast('配置已导出');
    });

    $('import').addEventListener('click', function () { $('import-file').click(); });

    $('import-file').addEventListener('change', function (e) {
      var file = e.target.files && e.target.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        try {
          var obj = JSON.parse(String(reader.result));
          var payload = obj && obj.settings ? obj.settings : obj;
          save(window.bfNormalize(payload), true);
          toast('配置已导入');
        } catch (err) {
          toast('导入失败：文件格式不正确');
        }
      };
      reader.readAsText(file, 'utf-8');
      e.target.value = '';
    });

    $('reset-all').addEventListener('click', function () {
      if (!confirm('确定要恢复默认设置吗？屏蔽词列表也会被清空。')) return;
      save(window.bfCloneDefaults(), true);
      toast('已恢复默认设置');
    });

    if (window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyPageTheme);
    }
  }

  ready(function () {
    getSettings().then(function (s) {
      settings = s;
      render();
      loadStats();
    });
    bind();
  });
})();
