# Zotero AI Reader - 发布流程

## 前置准备

### 环境变量
```powershell
# GitHub Personal Access Token (需要 repo 权限)
$env:GITHUB_TOKEN = "ghp_xxxxx"
```

### 工具检查
```bash
node --version  # 需要 Node.js 18+
npm --version
git --version
```

## 发布流程

### 1. 更新版本号

编辑 `package.json`：
```json
{
  "version": "1.x.x"
}
```

### 2. 修改代码并测试

- 在本地 Zotero 中测试所有功能
- 检查 Error Console 是否有错误
- 确认右键菜单、面板、设置都正常工作

### 3. 构建插件

```bash
npm run build
```

构建产物：
- `.scaffold/build/zotero-ai-reader.xpi`
- `.scaffold/build/update.json`

### 4. 计算 SHA512 Hash

```powershell
certutil -hashfile .scaffold/build/zotero-ai-reader.xpi SHA512
```

记录输出的 hash 值（用于验证）。

### 5. 提交代码

```bash
git add -A
git commit -m "chore: release v1.x.x

- 功能1描述
- 功能2描述
- Bug修复描述
"
```

### 6. 推送代码和标签

```bash
# 推送到 main
git push origin main

# 创建/更新版本 tag
git tag -f v1.x.x HEAD
git push origin v1.x.x --force

# 更新 release tag（用于自动更新）
git tag -f release HEAD
git push origin release --force
```

### 7. 上传 Release Assets

使用 GitHub API 上传文件到 release：

```powershell
# 设置变量
$VERSION = "1.x.x"
$TOKEN = $env:GITHUB_TOKEN
$REPO = "Callioper/zotero-aireader"

# 获取 release ID
$releaseInfo = curl.exe -s "https://api.github.com/repos/$REPO/releases/tags/v$VERSION" | ConvertFrom-Json
$RELEASE_ID = $releaseInfo.id

# 删除旧的 assets（如果存在）
$assets = curl.exe -s "https://api.github.com/repos/$REPO/releases/$RELEASE_ID/assets" | ConvertFrom-Json
foreach ($asset in $assets) {
    curl.exe -s -X DELETE -H "Authorization: token $TOKEN" "https://api.github.com/repos/$REPO/releases/assets/$($asset.id)"
}

# 上传 xpi
curl.exe -s -X POST -H "Authorization: token $TOKEN" -H "Content-Type: application/x-xpinstall" `
  "https://uploads.github.com/repos/$REPO/releases/$RELEASE_ID/assets?name=zotero-ai-reader.xpi" `
  --data-binary "@.scaffold/build/zotero-ai-reader.xpi"

# 上传 update.json
curl.exe -s -X POST -H "Authorization: token $TOKEN" -H "Content-Type: application/json" `
  "https://uploads.github.com/repos/$REPO/releases/$RELEASE_ID/assets?name=update.json" `
  --data-binary "@.scaffold/build/update.json"

# 同样上传到 release tag 的 release
$releaseTagInfo = curl.exe -s "https://api.github.com/repos/$REPO/releases/tags/release" | ConvertFrom-Json
$RELEASE_TAG_ID = $releaseTagInfo.id

# 删除 release tag 的旧 update.json
$releaseTagAssets = curl.exe -s "https://api.github.com/repos/$REPO/releases/$RELEASE_TAG_ID/assets" | ConvertFrom-Json
foreach ($asset in $releaseTagAssets) {
    if ($asset.name -eq "update.json") {
        curl.exe -s -X DELETE -H "Authorization: token $TOKEN" "https://api.github.com/repos/$REPO/releases/assets/$($asset.id)"
    }
}

# 上传新的 update.json 到 release tag
curl.exe -s -X POST -H "Authorization: token $TOKEN" -H "Content-Type: application/json" `
  "https://uploads.github.com/repos/$REPO/releases/$RELEASE_TAG_ID/assets?name=update.json" `
  --data-binary "@.scaffold/build/update.json"
```

### 8. 更新 Release 说明

```powershell
$body = @'
## v1.x.x 更新说明

### 🐛 Bug 修复

1. **修复描述**
   - 详细说明

### ✨ 新增功能

1. **功能描述**
   - 详细说明

### 📝 已知问题

- 问题描述

### 🔗 下载

- [zotero-ai-reader.xpi](https://github.com/Callioper/zotero-aireader/releases/download/v1.x.x/zotero-ai-reader.xpi)
- SHA512: `hash值`
'@

$json = @{body=$body} | ConvertTo-Json
Invoke-RestMethod -Uri "https://api.github.com/repos/$REPO/releases/$RELEASE_ID" `
  -Method PATCH `
  -Headers @{Authorization="token $TOKEN"} `
  -Body $json `
  -ContentType "application/json"
```

## 验证发布

### 1. 检查 GitHub Release

访问 https://github.com/Callioper/zotero-aireader/releases/tag/v1.x.x

确认：
- ✅ xpi 文件存在且大小正确
- ✅ update.json 存在
- ✅ Release 说明完整

### 2. 检查自动更新端点

```bash
curl -L https://github.com/Callioper/zotero-aireader/releases/download/release/update.json
```

应该返回最新版本的 update.json。

### 3. 在 Zotero 中测试

1. 卸载旧版本
2. 重启 Zotero
3. 安装新版本 xpi
4. 测试所有功能：
   - 右侧面板显示
   - 设置面板文字显示
   - 右键菜单工作
   - AI 对话功能
   - 自动更新检测

## 常见问题

### Q: GitHub Actions 自动上传了旧的 xpi 怎么办？

A: 手动删除 GitHub Actions 上传的 asset，然后重新上传本地构建的 xpi。

### Q: update.json 的 hash 不匹配怎么办？

A: 重新计算 xpi 的 SHA512 hash，手动编辑 `.scaffold/build/update.json`，然后重新上传。

### Q: 菜单/面板重复注册警告？

A: 这是因为插件被重复加载。在开发模式下正常，生产环境不影响功能。

### Q: 设置面板文字不显示？

A: 检查 FTL 文件是否正确加载。在 `bootstrap.js` 中确认 locale 注册，在 `hooks.ts` 中确认 `document.l10n.addResourceIds()` 调用。

## 版本号规范

遵循语义化版本 (Semantic Versioning)：

- **主版本号 (Major)**: 不兼容的 API 变更
- **次版本号 (Minor)**: 向下兼容的功能新增
- **修订号 (Patch)**: 向下兼容的 Bug 修复

示例：
- `1.0.0` → `1.0.1`: Bug 修复
- `1.0.1` → `1.1.0`: 新增功能
- `1.1.0` → `2.0.0`: 破坏性变更

## 自动化脚本（可选）

创建 `scripts/release.ps1`：

```powershell
param(
    [Parameter(Mandatory=$true)]
    [string]$Version,
    
    [Parameter(Mandatory=$true)]
    [string]$Token
)

# 设置错误时停止
$ErrorActionPreference = "Stop"

Write-Host "🚀 Starting release process for v$Version" -ForegroundColor Green

# 1. 构建
Write-Host "📦 Building plugin..." -ForegroundColor Yellow
npm run build

# 2. 计算 hash
Write-Host "🔐 Calculating SHA512 hash..." -ForegroundColor Yellow
$hash = (certutil -hashfile .scaffold/build/zotero-ai-reader.xpi SHA512 | Select-String -Pattern "^[a-f0-9]{128}$").ToString()
Write-Host "Hash: $hash" -ForegroundColor Cyan

# 3. 提交代码
Write-Host "📝 Committing changes..." -ForegroundColor Yellow
git add -A
git commit -m "chore: release v$Version"

# 4. 推送
Write-Host "⬆️  Pushing to GitHub..." -ForegroundColor Yellow
git push origin main
git tag -f "v$Version" HEAD
git push origin "v$Version" --force
git tag -f release HEAD
git push origin release --force

# 5. 上传 assets
Write-Host "📤 Uploading release assets..." -ForegroundColor Yellow
# ... (使用上面的 API 调用代码)

Write-Host "✅ Release v$Version completed!" -ForegroundColor Green
Write-Host "🔗 https://github.com/Callioper/zotero-aireader/releases/tag/v$Version" -ForegroundColor Cyan
```

使用方法：
```powershell
.\scripts\release.ps1 -Version "1.2.1" -Token $env:GITHUB_TOKEN
```

## 回滚流程

如果发布有问题需要回滚：

```bash
# 1. 删除远程 tag
git push origin :refs/tags/v1.x.x

# 2. 删除本地 tag
git tag -d v1.x.x

# 3. 在 GitHub 上删除 Release（Web 界面操作）

# 4. 重新发布正确的版本
```

## 参考资料

- [GitHub Releases API](https://docs.github.com/en/rest/releases)
- [Zotero Plugin Development](https://www.zotero.org/support/dev/zotero_7_for_developers)
- [Semantic Versioning](https://semver.org/)
