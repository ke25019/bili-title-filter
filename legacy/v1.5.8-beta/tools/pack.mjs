/**
 * 打包脚本：把扩展的运行时文件拷到一个干净目录里，顺便压掉体积。
 *
 * 用法：node tools/pack.mjs <输出目录>
 *   例：node tools/pack.mjs "$env:TEMP\bf-pack"   （PowerShell 里）
 *   之后用 PowerShell 的 [System.IO.Compression.ZipFile]::CreateFromDirectory 打 zip
 *
 * 它做三件事：
 *   1) 只拷运行时需要的东西 —— 不带 README / AGENTS（文档在 GitHub 上，包里是纯负担：
 *      三个 README + AGENTS 合计约 97 KB，占原始体积的三分之一）
 *   2) 去掉整行注释、空行，并在安全的前提下压掉行首缩进（见 stripComments 的说明）
 *   3) 对每个 JS 做一次语法编译校验，任何文件不过就整体报错退出
 *
 * 为什么不改仓库里的源文件：仓库里保留完整注释（那是这个项目的实测记录），
 * 压缩只发生在打包副本上。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = process.argv[2];
if (!OUT) {
  console.error('用法：node tools/pack.mjs <输出目录>');
  process.exit(1);
}

/** 运行时需要的文件/目录（不含 README*、AGENTS.md、legacy、tests、dist） */
const INCLUDE = [
  'manifest.json',
  'background.js',
  'LICENSE',
  'shared',
  'content',
  'options',
  'popup',
  'icons',
  '_locales'
];

/**
 * 逐行安全剥离注释：
 *   - 跟踪块注释状态：`/*` 开头（以及行内出现 `/*` 但没在同一行闭合）就进入块注释，
 *     直到某一行出现 `*\/` 为止。这一步是必须的 —— 我们的块注释里有**不以 `*` 开头**的
 *     续行（例如"弹幕列表里的推广条本身就是一条弹幕……"），只看行首字符会把续行当成代码留下，
 *     结果就是语法错误（打包脚本里的语法校验抓到过一次）。
 *   - 只删"整行都是注释"的行，绝不碰含代码的行 —— 不需要懂 JS 词法，
 *     也不用担心字符串/正则里出现的 `//`。
 *   - 只有在剩下的代码里已经没有反引号时才压掉行首缩进：反引号意味着
 *     可能存在跨行模板字符串，那种情况下压缩进会改掉字符串内容。
 */
function stripComments(src) {
  const kept = [];
  const originals = [];
  let inBlock = false;

  for (const line of src.split(/\r?\n/)) {
    const t = line.trim();
    if (inBlock) {
      if (t.includes('*/')) inBlock = false;
      continue;
    }
    if (!t) continue;
    if (t.startsWith('//')) continue;
    if (t.startsWith('/*')) {
      if (!t.includes('*/')) { inBlock = true; continue; }
      // 注释和代码挤在同一行（例如 `/** 说明 */ function foo() {`）：注释去掉、代码留下。
      // 少了这一步，整行会被当成注释删掉，编译校验就会报语法错误（实测踩过）。
      const rest = t.slice(t.indexOf('*/') + 2).trim();
      if (!rest) continue;
      kept.push(rest);
      originals.push(rest);
      continue;
    }
    kept.push(t);
    originals.push(line.replace(/\s+$/, ''));
    // 行内起头、本行没闭合的块注释 → 后面的续行一起跳过
    const open = t.indexOf('/*');
    if (open !== -1 && t.indexOf('*/', open + 2) === -1) inBlock = true;
  }

  // 源文件里有反引号就不动缩进：可能是跨行模板字符串，压缩进会改掉字符串内容
  return (src.includes('`') ? originals : kept).join('\n');
}

/** CSS：删注释行、空行，压缩进（CSS 字符串都在单行内，安全） */
function stripCss(src) {
  return src
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('/*') && !l.startsWith('*'))
    .join('\n');
}

function walk(dir) {
  const out = [];
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

function copyInto(src, dst) {
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
}

// 注意用 fileURLToPath：仓库路径里有空格，直接拿 URL.pathname 会带上 %20
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
fs.rmSync(OUT, { recursive: true, force: true });

let rawBefore = 0;
let rawAfter = 0;
const report = [];

for (const item of INCLUDE) {
  const srcPath = path.join(root, item);
  if (!fs.existsSync(srcPath)) continue;
  const files = fs.statSync(srcPath).isDirectory() ? walk(srcPath) : [srcPath];

  for (const file of files) {
    const rel = path.relative(root, file);
    const dst = path.join(OUT, rel);
    const original = fs.readFileSync(file);
    rawBefore += original.length;

    // 只对文本文件做"重写"，其它（图标 PNG 这类二进制）必须原样拷贝 ——
    // 一律 toString/from 会把 PNG 写成替换字符，文件反而变大且彻底损坏（实测踩过）
    const isText = /\.(js|mjs|css|json|html)$/.test(rel);
    if (!isText) {
      copyInto(file, dst);
      rawAfter += original.length;
      continue;
    }

    let text = original.toString('utf8');

    if (/\.(js|mjs)$/.test(rel)) {
      text = stripComments(text);
      try {
        // 只编译不执行：语法错误会在这里抛出来
        new Function(text);
      } catch (e) {
        console.error(`[pack] 语法校验失败：${rel} —— ${e.message}`);
        process.exit(1);
      }
    } else if (/\.css$/.test(rel)) {
      text = stripCss(text);
    } else if (/\.json$/.test(rel)) {
      JSON.parse(text);          // 顺手校验 JSON
    }

    const out = Buffer.from(text, 'utf8');
    rawAfter += out.length;
    copyInto(file, dst);
    fs.writeFileSync(dst, out);
    const saved = original.length - out.length;
    if (saved > 0) report.push([rel, original.length, out.length]);
  }
}

report.sort((a, b) => (b[1] - b[2]) - (a[1] - a[2]));
for (const [rel, before, after] of report) {
  console.log(`  ${rel}: ${(before / 1024).toFixed(1)} KB → ${(after / 1024).toFixed(1)} KB`);
}
console.log(`\n共 ${LOOSE()} 个文件；原始 ${(rawBefore / 1024).toFixed(1)} KB → 输出 ${(rawAfter / 1024).toFixed(1)} KB` +
  `（省 ${((rawBefore - rawAfter) / 1024).toFixed(1)} KB，${(((rawBefore - rawAfter) / rawBefore) * 100).toFixed(0)}%）`);
console.log(`输出目录：${OUT}`);

function LOOSE() {
  return walk(OUT).length;
}
