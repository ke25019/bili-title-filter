/** B站屏蔽助手 - 扩展弹窗（快捷设置） */
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

  function getSettings() {
    return new Promise(function (resolve) {
      chrome.storage.sync.get('bfSettings', function (v) {
        resolve(window.bfNormalize(v && v.bfSettings));
      });
    });
  }

  function save(patch) {
    settings = window.bfNormalize(Object.assign({}, settings, patch));
    chrome.storage.sync.set({ bfSettings: settings });
    render();
  }

  function render() {
    $('enabled').classList.toggle('is-on', !!settings.enabled);
    $('enabled').setAttribute('aria-checked', settings.enabled ? 'true' : 'false');

    Array.prototype.forEach.call(document.querySelectorAll('#mode button'), function (b) {
      b.classList.toggle('is-active', b.dataset.value === settings.mode);
    });
    $('mode-hint').textContent = settings.mode === 'mask'
      ? (settings.revealOnHover ? '封面与标题合并为一整块，鼠标悬停可查看' : '封面与标题合并为一整块提示区域')
      : (settings.hideKeepSlot !== false ? '卡片不再显示，但原来的位置留空（页面不重排）' : '卡片整个移除，后面的内容前移补位');

    // 「隐藏时保留原位置」只对完全隐藏有意义
    const keepRow = $('keepslot-row');
    const keepBtn = $('keepslot');
    const showKeep = settings.mode === 'hide';
    keepRow.style.display = showKeep ? 'flex' : 'none';
    $('keepslot-hint').style.display = showKeep ? 'block' : 'none';
    keepBtn.classList.toggle('is-on', settings.hideKeepSlot !== false);
    keepBtn.setAttribute('aria-checked', settings.hideKeepSlot !== false ? 'true' : 'false');

    Array.prototype.forEach.call(document.querySelectorAll('#theme button'), function (b) {
      b.classList.toggle('is-active', b.dataset.value === settings.theme);
    });

    var chips = $('chips');
    chips.innerHTML = '';
    if (!settings.keywords.length) {
      var empty = document.createElement('div');
      empty.className = 'empty';
      empty.textContent = '还没有屏蔽词，添加后立即生效';
      chips.appendChild(empty);
    } else {
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

    var typesBox = $('types');
    if (!typesBox.dataset.built) {
      TYPES.forEach(function (t) {
        var el = document.createElement('div');
        el.className = 'type';
        el.dataset.key = t.key;
        el.title = t.desc;
        el.textContent = t.label;
        el.addEventListener('click', function () {
          var next = Object.assign({}, settings.blockTypes);
          next[t.key] = !next[t.key];
          save({ blockTypes: next });
        });
        typesBox.appendChild(el);
      });
      typesBox.dataset.built = '1';
    }
    Array.prototype.forEach.call(typesBox.querySelectorAll('.type'), function (el) {
      el.classList.toggle('is-active', !!settings.blockTypes[el.dataset.key]);
    });

    var bannerBtn = $('banner');
    bannerBtn.classList.toggle('is-on', !!settings.blockBanner);
    bannerBtn.setAttribute('aria-checked', settings.blockBanner ? 'true' : 'false');
  }

  function addKeyword() {
    var input = $('kw-input');
    var raw = (input.value || '').trim();
    if (!raw) return;
    var parts = settings.useRegex ? [raw] : raw.split(/[,，、;；\s]+/);
    var list = settings.keywords.slice();
    parts.forEach(function (p) {
      var v = p.trim();
      if (v && list.indexOf(v) === -1) list.push(v);
    });
    input.value = '';
    save({ keywords: list });
  }

  function loadStats() {
    chrome.runtime.sendMessage({ type: 'BF_GET_STATS' }, function (s) {
      if (chrome.runtime.lastError || !s) return;
      $('stats').textContent = '今日屏蔽 ' + s.today + ' 个 · 累计 ' + s.total + ' 个';
    });
  }

  ready(function () {
    getSettings().then(function (s) {
      settings = s;
      render();
    });

    $('enabled').addEventListener('click', function () {
      save({ enabled: !settings.enabled });
    });

    $('mode').addEventListener('click', function (e) {
      var b = e.target.closest('button[data-value]');
      if (b) save({ mode: b.dataset.value });
    });

    // 完全隐藏：保留原位置 / 移除位置
    $('keepslot').addEventListener('click', function () {
      save({ hideKeepSlot: !(settings.hideKeepSlot !== false) });
    });

    $('theme').addEventListener('click', function (e) {
      var b = e.target.closest('button[data-value]');
      if (b) save({ theme: b.dataset.value });
    });

    $('kw-add').addEventListener('click', addKeyword);
    $('kw-input').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); addKeyword(); }
    });

    // 首页顶部的大轮播横幅：独立开关
    $('banner').addEventListener('click', function () {
      save({ blockBanner: !settings.blockBanner });
    });

    $('open-options').addEventListener('click', function () {
      chrome.runtime.openOptionsPage();
      window.close();
    });

    loadStats();
  });
})();
