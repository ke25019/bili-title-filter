/**
 * 依次运行全部验证脚本：node run-all.js
 * 依赖：npm i jsdom（在 tests 目录下执行）
 */
const { spawnSync } = require('child_process');
const path = require('path');

const files = ['test-content.js', 'test-ui.js', 'test-background.js'];
let failed = 0;

for (const f of files) {
  console.log('\n############### ' + f + ' ###############');
  const r = spawnSync(process.execPath, [path.join(__dirname, f)], { stdio: 'inherit' });
  if (r.status !== 0) failed++;
}

console.log('\n############### 汇总 ###############');
console.log(failed === 0 ? '全部验证脚本通过 ✅' : failed + ' 个验证脚本存在失败项 ❌');
process.exit(failed ? 1 : 0);
