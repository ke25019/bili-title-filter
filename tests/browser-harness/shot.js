/**
 * CDP 截图：node shot.js <输出png> [full]
 * full  = 整页截图（会临时覆盖 device metrics，用完请用 reset 还原）
 * reset = 清除 device metrics 覆盖，恢复真实视口
 *
 * 安全：必须存在 safe-edge.ps1 写下的 .test-instance.json 标记文件才会连接。
 */
const fs = require('fs');
const path = require('path');

const MARKER = path.join(__dirname, '.test-instance.json');
if (!fs.existsSync(MARKER)) {
  console.error('未找到 .test-instance.json —— 请先用 safe-edge.ps1 -Action start 启动独立测试实例。');
  process.exit(2);
}
const meta = JSON.parse(fs.readFileSync(MARKER, 'utf8'));
const PORT = meta.port || 9223;

(async () => {
  const out = process.argv[2] || 'shot.png';
  const mode = process.argv[3] || '';
  const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
  const pages = list.filter((t) => t.type === 'page');
  const page = pages.find((t) => /bilibili\.com/.test(t.url)) || pages[0];
  if (!page) { console.log('NO_TARGET'); process.exit(1); }

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('ws error')); });

  let id = 0;
  const send = (method, params) => new Promise((resolve) => {
    const myId = ++id;
    const h = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id === myId) { ws.removeEventListener('message', h); resolve(msg); }
    };
    ws.addEventListener('message', h);
    ws.send(JSON.stringify({ id: myId, method, params }));
  });

  if (mode === 'reset') {
    await send('Emulation.clearDeviceMetricsOverride', {});
    console.log('device metrics 已清除');
    ws.close(); process.exit(0);
  }

  if (mode === 'full') {
    const m = await send('Page.getLayoutMetrics', {});
    const c = m.result.cssContentSize;
    await send('Emulation.setDeviceMetricsOverride', {
      width: Math.ceil(c.width), height: Math.ceil(Math.min(c.height, 4000)), deviceScaleFactor: 1, mobile: false
    });
    await new Promise((r) => setTimeout(r, 900));
  }

  const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: mode === 'full' });
  fs.writeFileSync(out, Buffer.from(r.result.data, 'base64'));
  console.log('saved ' + out + ' (' + Math.round(fs.statSync(out).size / 1024) + ' KB)');
  ws.close();
  process.exit(0);
})().catch((e) => { console.error('截图失败:', e.message); process.exit(1); });
