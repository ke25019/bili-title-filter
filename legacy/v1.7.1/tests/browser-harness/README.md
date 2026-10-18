# 真实浏览器调试脚手架（安全规范）

这些脚本用于把扩展装进一个**独立的无头 Edge 实例**里做真实页面验证。
**设计的第一原则：绝不能影响你日常使用的浏览器。**

## 铁律

0. **运行任何真实浏览器实例之前，必须先向使用者确认并获得同意。**
   不要"顺手跑一下"——先问一句"我可以启动一个独立测试浏览器验证吗"。
   使用者日常正在用浏览器，任何未经确认的浏览器操作都可能打断他。

1. **绝不按进程名杀进程**
   不使用 `Stop-Process -Name msedge`、`Get-Process msedge | Stop-Process` 这类写法——
   那会把你正在用的所有 Edge 窗口一起杀掉。
   本目录的 `Stop-BfTestEdge` 只会结束 **命令行里带我们专属 profile 路径** 的进程。

2. **独立 profile + 独立端口**
   实例使用 `%TEMP%\bf-test-edge` 作为 `--user-data-dir`，调试端口固定为 `9223`，
   与你默认 profile（`...\Microsoft\Edge\User Data`）完全隔离。

3. **永远带 `--disable-sync`**
   否则你的扩展配置会被同步进测试实例；
   反过来，测试里改动开关也可能同步回你的账号，污染你真实浏览器里的设置。

4. **连不上就退出**
   `probe.js` / `shot.js` 会先检查 `.test-instance.json` 标记文件，
   没有标记文件就拒绝连接，避免误连到别的浏览器实例。

## 用法

```powershell
cd tests\browser-harness

# 1) 启动独立测试实例（不会碰到你正在用的 Edge）
.\safe-edge.ps1 -Action start `
    -ExtensionPath "H:\path\to\bili-title-filter" `
    -Url "https://www.bilibili.com/"

# 2) 取页面数据 / 截图
node probe.js my-expr.js        # 表达式文件，返回 JSON
node probe.js scenarios\partition-residual.js   # 现成场景：完全隐藏下外层盒子是否真的消失
node shot.js out.png            # 视口截图
node shot.js out.png full       # 整页截图

# 3) 只关闭我们自己的实例（你正在用的 Edge 不受影响）
.\safe-edge.ps1 -Action stop

# 查看当前状态
.\safe-edge.ps1 -Action status
```

## 排查"影响正常使用"的检查清单

- [ ] 关闭测试实例用的是 `safe-edge.ps1 -Action stop`，而不是 `Stop-Process -Name msedge`
- [ ] 启动参数里带了 `--disable-sync`
- [ ] `--user-data-dir` 指向 `%TEMP%\bf-test-edge`，不是你的默认 profile
- [ ] 结束调试后，`safe-edge.ps1 -Action status` 显示 0 个测试进程
