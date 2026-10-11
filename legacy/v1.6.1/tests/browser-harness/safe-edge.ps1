<#
.SYNOPSIS
  安全地启动 / 关闭「独立无头 Edge 测试实例」，绝不影响用户日常使用的浏览器。

.DESCRIPTION
  为什么需要这个脚本：
  直接用 `Get-Process msedge | Stop-Process -Force` 会把用户正在使用的所有 Edge 窗口一起杀掉。
  本脚本只操作「命令行里带我们专属 profile 路径」的进程，其余一律不碰。

.例
  .\safe-edge.ps1 -Action start -ExtensionPath "H:\path\to\ext" -Url "https://www.bilibili.com/"
  .\safe-edge.ps1 -Action status
  .\safe-edge.ps1 -Action stop
#>
param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('start', 'stop', 'status')]
  [string]$Action,

  [string]$ExtensionPath,
  [string]$Url = 'https://www.bilibili.com/',
  [int]$Port = 9223
)

$ErrorActionPreference = 'Stop'

# 专属 profile 与标记文件：只认这两个，绝不使用用户默认 profile
$ProfileDir = Join-Path $env:TEMP 'bf-test-edge'
$MarkerFile = Join-Path $PSScriptRoot '.test-instance.json'
$EdgeCandidates = @(
  "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
  "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
)

function Get-TestEdgeProcesses {
  <# 只返回「命令行包含我们专属 profile 路径」的 msedge 进程 #>
  Get-CimInstance Win32_Process -Filter "Name='msedge.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -and $_.CommandLine -like "*$ProfileDir*" }
}

function Get-UserEdgeProcessCount {
  <# 用户自己的 Edge 进程（只统计、绝不操作）#>
  (Get-CimInstance Win32_Process -Filter "Name='msedge.exe'" -ErrorAction SilentlyContinue |
    Where-Object { -not ($_.CommandLine -and $_.CommandLine -like "*$ProfileDir*") } |
    Measure-Object).Count
}

function Assert-SafeProfilePath {
  if ($ProfileDir -notlike "$env:TEMP*" -or (Split-Path $ProfileDir -Leaf) -ne 'bf-test-edge') {
    throw "安全校验失败：profile 路径不在预期位置，拒绝继续（$ProfileDir）"
  }
}

switch ($Action) {
  'status' {
    $mine = @(Get-TestEdgeProcesses)
    "测试实例进程数 : $($mine.Count)"
    if ($mine.Count) { $mine | ForEach-Object { "  pid=$($_.ProcessId)" } }
    "用户自己的 Edge : $(Get-UserEdgeProcessCount) 个进程（本脚本绝不触碰）"
    "profile 目录    : $ProfileDir"
    if (Test-Path $MarkerFile) { "标记文件        : 存在（端口 $(Get-Content $MarkerFile -Raw | ConvertFrom-Json).port）" }
    else { "标记文件        : 不存在（说明当前没有在跑的测试实例）" }
  }

  'start' {
    Assert-SafeProfilePath
    if (-not $ExtensionPath) { throw '缺少 -ExtensionPath 参数' }
    if (-not (Test-Path (Join-Path $ExtensionPath 'manifest.json'))) { throw "目标目录里没有 manifest.json：$ExtensionPath" }
    $edge = $EdgeCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
    if (-not $edge) { throw '未找到 msedge.exe' }

    # 只清理我们自己的残留实例
    $existing = @(Get-TestEdgeProcesses)
    if ($existing.Count) {
      "发现上次残留的测试实例 $($existing.Count) 个，先只关闭它们"
      $existing | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
      Start-Sleep -Seconds 3
    }

    if (Test-Path $ProfileDir) { Remove-Item $ProfileDir -Recurse -Force -ErrorAction SilentlyContinue }
    New-Item -ItemType Directory -Force -Path $ProfileDir | Out-Null

    # --disable-sync 必须保留：否则会同步用户的扩展配置
    $argStr = "--headless=new --remote-debugging-port=$Port --remote-debugging-address=127.0.0.1 " +
              "--user-data-dir=`"$ProfileDir`" --load-extension=`"$ExtensionPath`" " +
              "--disable-extensions-except=`"$ExtensionPath`" --disable-sync " +
              "--no-first-run --no-default-browser-check --disable-features=Translate --window-size=1440,900 " +
              $Url
    $proc = Start-Process -FilePath $edge -ArgumentList $argStr -PassThru
    $markerJson = @{ port = $Port; profile = $ProfileDir; extension = $ExtensionPath; startedAt = (Get-Date).ToString('s'); launcherPid = $proc.Id } | ConvertTo-Json
    [System.IO.File]::WriteAllText($MarkerFile, $markerJson, (New-Object System.Text.UTF8Encoding($false)))

    $ok = $false
    for ($i = 1; $i -le 25; $i++) {
      Start-Sleep -Seconds 2
      try { $null = Invoke-RestMethod "http://127.0.0.1:$Port/json/version" -TimeoutSec 3; $ok = $true; break } catch { }
    }
    if ($ok) {
      "测试实例已就绪（端口 $Port），等待页面加载..."
      Start-Sleep -Seconds 15
      "现在可以用：node probe.js <表达式文件>  /  node shot.js out.png"
    } else {
      "测试实例未能就绪，请检查端口 $Port 是否被占用"
    }
    "（提示：用户自己的 Edge 进程 $((Get-UserEdgeProcessCount)) 个，本次操作一个都没碰）"
  }

  'stop' {
    Assert-SafeProfilePath
    $mine = @(Get-TestEdgeProcesses)
    if (-not $mine.Count) { "没有正在运行的测试实例（用户自己的 Edge 未受影响）"; break }
    $mine | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
    Start-Sleep -Seconds 2
    "已关闭 $($mine.Count) 个测试实例进程（仅限专属 profile）"
    "用户自己的 Edge 进程 $((Get-UserEdgeProcessCount)) 个，未受影响"
    if (Test-Path $MarkerFile) { Remove-Item $MarkerFile -Force -ErrorAction SilentlyContinue }
  }
}
