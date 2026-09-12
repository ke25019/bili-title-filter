/**
 * CDP 探针：在测试页面里执行一个表达式并打印 JSON 结果。
 * 用法：node probe.js <表达式文件>      （表达式文件内容是一个可求值的 JS 表达式）
 *       BF_STEP=1 node probe.js <文件>  （可在表达式里读 globalThis.__STEP__）
 *
 * 安全：必须存在 safe-edge.ps1 写下的 .test-instance.json 标记文件才会连接，
 *       避免误连到用户自己的浏览器实例。
 */
const fs = require('fs');
const path = require('path');

const MARKER = path.join(__dirname, '.test-instance.json');
if (!fs.existsSync(MARKER)) {
  console.error('未找到 .test-instance.json —— 请先用 safe-edge.ps1 -Action start 启动独立测试实例。');
  console.error('（这条检查是为了防止误连到你自己正在使用的浏览器）');
  process.exit(2);
}
const meta = JSON.parse(fs.readFileSync(MARKER, 'utf8'));
const PORT = meta.port || 9223;
const exprFile = process.argv[2];
if (!exprFile) { console.error('用法: node probe.js <表达式文件>'); process.exit(2); }
const expr = fs.readFileSync(exprFile, 'utf8');

(async () => {
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

  if (process.env.BF_STEP !== undefined) {
    await send('Runtime.evaluate', { expression: `globalThis.__STEP__=${JSON.stringify(process.env.BF_STEP)};` });
  }

  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  const out = r.result && r.result.result ? r.result.result.value : r;
  console.log(typeof out === 'string' ? out : JSON.stringify(out, null, 2));
  if (r.result && r.result.exceptionDetails) console.log('EXCEPTION:', JSON.stringify(r.result.exceptionDetails.text));
  ws.close();
  process.exit(0);
})().catch((e) => { console.error('探针失败:', e.message); process.exit(1); });
