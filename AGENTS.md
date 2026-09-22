# 协作约定（本仓库的开发规范）

本文件记录本项目的开发与调试约定，供人类贡献者与 AI 助手共同遵守。

---

## 1. 绝不影响使用者的正常使用（最高优先级）

**真实浏览器调试必须先征得同意。** 启动任何浏览器实例（哪怕是 `--headless=new`）之前，
必须先问一句并得到明确同意，不要"顺手跑一下"。

原因：使用者本机正在使用 Edge。曾经出现过两种真实事故：

| 事故 | 后果 | 正确做法 |
| --- | --- | --- |
| 用 `Get-Process msedge \| Stop-Process -Force` 收尾 | **杀掉使用者所有 Edge 窗口与标签页** | 只用 `tests/browser-harness/safe-edge.ps1 -Action stop`，它只结束命令行带专属 profile 的进程 |
| 启动测试实例时漏加 `--disable-sync` | 使用者的扩展配置被同步进测试实例，测试中的改动也可能同步回其账号 | 始终带 `--disable-sync`，并固定使用 `%TEMP%\bf-test-edge` 独立 profile |

其它同类要求：

- 不修改使用者默认 profile（`...\Microsoft\Edge\User Data`）下的任何内容
- 不写注册表、不改系统设置、不动使用者目录之外的路径
- 测试产物只放在 `%TEMP%` 与仓库内，用完清理

## 2. 改动前先复现，不靠猜

本项目的多数问题都出在"按猜测改选择器/加补丁"，正确顺序是：

1. 先用 `tests/` 的 jsdom 用例复现（结构类问题）
2. jsdom 测不出来的（真实 DOM、布局回流、占位块、尺寸相关）→ 征得同意后用
   `tests/browser-harness/` 抓真实数据与截图
3. 拿到证据再改，并把该场景补成回归用例

## 3. 安全阀原则

内容脚本涉及页面布局，任何"可能把整块区域隐藏/遮蔽"的动作都必须有安全阀，
无法确认时**宁可不屏蔽**：

- 容器内部还装着别的卡片 → 判定为列表，放弃
- 尺寸超过 1200×800 或视口面积 35% → 放弃
- 尺寸为 0（隐藏元素）→ 放弃
- 命中加载哨兵（`load-more-anchor` 等）→ 只做 `visibility:hidden`，保留布局盒，确保站点仍能加载

## 4. 版本与发布流程

1. `manifest.json` 的 `version` 升版本号（如 `1.1.5`）
2. 三个 README 同步更新：`README.md`（语言导航）、`README.zh-CN.md`、`README.en.md`
   —— 含功能说明、更新日志、校验项计数
3. 把上一个版本用 `git archive <tag> --prefix=legacy/<版本>/ -o x.zip -- . ":(exclude)legacy"`
   归档到 `legacy/`（**必须排除 legacy 自身，否则会递归膨胀**）
4. 打包：`manifest.json` 必须在 zip **根目录**，且不含 `legacy/`、`tests/`；
   **`_locales/` 必须打进去**（扩展商店靠它识别语言），manifest 的 `default_locale` 也要在；
   本地化后的文案有长度上限：`name` ≤ 45 字符、`description` ≤ 132 字符
   （Edge 商店的 Description 上限是 190，Chrome 更严，按 132 卡就不会被商店打回）
5. 提交 → 打标签 `vX.Y.Z-beta` → 推送 `main` 与标签
6. 在 GitHub 建 Release（预发布），上传 zip 附件，并实测附件可下载

## 5. 文档与语言

- 中文文档：`README.zh-CN.md`；英文文档：`README.en.md`；`README.md` 只做语言导航
- 代码注释、提交信息用中文；变量与函数名用英文
- 涉及实测结论时，把**测到的真实类名/尺寸/数量**写进注释与文档，便于日后核对

## 6. 校验项计数要一致

改动测试后，`README.md`、`README.zh-CN.md`、`README.en.md`、`tests/README.md` 里的
校验项数量必须一起更新（可通过 `cd tests && npm test` 得到准确数字）。

## 7. PowerShell 注意

- 写 `.ps1` 脚本给 Windows PowerShell 5.1 使用时，文件必须带 **UTF-8 BOM**，否则中文会乱码并报语法错误
- 用 `[System.IO.File]::WriteAllText($path, $text, (New-Object System.Text.UTF8Encoding($true)))` 写带 BOM 的文件
- 读文件统一显式指定 `[System.Text.Encoding]::UTF8`，不要用 `Get-Content` 的默认编码
