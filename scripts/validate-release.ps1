# Zotero AI Reader - Pre-Release Validation Script
# 在发布前运行此脚本，确保 l10n 配置正确

Write-Host "=== Zotero AI Reader - Pre-Release Validation ===" -ForegroundColor Cyan
Write-Host ""

$errors = 0

# 1. 检查 FTL 文件是否存在
Write-Host "[1/6] Checking FTL files..." -ForegroundColor Yellow
$ftlZhCN = "addon\locale\zh-CN\addon.ftl"
$ftlEnUS = "addon\locale\en-US\addon.ftl"

if (Test-Path $ftlZhCN) {
    $size = (Get-Item $ftlZhCN).Length
    if ($size -gt 2500) {
        Write-Host "  ✓ zh-CN FTL exists ($size bytes)" -ForegroundColor Green
    } else {
        Write-Host "  ✗ zh-CN FTL too small ($size bytes)" -ForegroundColor Red
        $errors++
    }
} else {
    Write-Host "  ✗ zh-CN FTL missing" -ForegroundColor Red
    $errors++
}

if (Test-Path $ftlEnUS) {
    Write-Host "  ✓ en-US FTL exists" -ForegroundColor Green
} else {
    Write-Host "  ✗ en-US FTL missing" -ForegroundColor Red
    $errors++
}

# 2. 检查 preferences.xhtml 中的 l10n-id 是否有前缀
Write-Host ""
Write-Host "[2/6] Checking preferences.xhtml l10n-id prefixes..." -ForegroundColor Yellow
$xhtmlPath = "addon\content\preferences.xhtml"
$missingPrefix = Select-String -Path $xhtmlPath -Pattern 'data-l10n-id="(?!zoteroAIRreader-)[^"]+"'

if ($missingPrefix) {
    Write-Host "  ✗ Found l10n-id without prefix:" -ForegroundColor Red
    $missingPrefix | ForEach-Object { Write-Host "    $_" -ForegroundColor Red }
    $errors++
} else {
    Write-Host "  ✓ All l10n-id have correct prefix" -ForegroundColor Green
}

# 3. 检查 bootstrap.js 中的 locale 注册
Write-Host ""
Write-Host "[3/6] Checking bootstrap.js locale registration..." -ForegroundColor Yellow
$bootstrap = Get-Content "addon\bootstrap.js" -Raw
if ($bootstrap -match 'locale.*zh-CN' -and $bootstrap -match 'locale.*en-US') {
    Write-Host "  ✓ Locale registration found" -ForegroundColor Green
} else {
    Write-Host "  ✗ Locale registration missing or incomplete" -ForegroundColor Red
    $errors++
}

# 4. 检查 hooks.ts 中的 FTL 加载
Write-Host ""
Write-Host "[4/6] Checking hooks.ts FTL loading..." -ForegroundColor Yellow
$hooks = Get-Content "src\hooks.ts" -Raw
if ($hooks -match 'document\.l10n\.addResourceIds') {
    Write-Host "  ✓ FTL loading via document.l10n found" -ForegroundColor Green
} else {
    Write-Host "  ✗ FTL loading missing" -ForegroundColor Red
    $errors++
}

if ($hooks -match 'new Localization') {
    Write-Host "  ⚠ WARNING: 'new Localization()' found - may cause errors" -ForegroundColor Yellow
}

# 5. 检查菜单注销
Write-Host ""
Write-Host "[5/6] Checking menu unregistration in onShutdown..." -ForegroundColor Yellow
if ($hooks -match 'unregisterMenu') {
    Write-Host "  ✓ Menu unregistration found" -ForegroundColor Green
} else {
    Write-Host "  ⚠ WARNING: Menu unregistration not found" -ForegroundColor Yellow
}

# 6. 构建并检查产物
Write-Host ""
Write-Host "[6/6] Building and checking output..." -ForegroundColor Yellow
npm run build 2>&1 | Out-Null

if (Test-Path ".scaffold\build\zotero-ai-reader.xpi") {
    $xpiSize = (Get-Item ".scaffold\build\zotero-ai-reader.xpi").Length
    Write-Host "  ✓ XPI built successfully ($xpiSize bytes)" -ForegroundColor Green
    
    # 检查构建产物中的 FTL
    if (Test-Path ".scaffold\build\addon\locale\zh-CN\zoteroAIRreader-addon.ftl") {
        Write-Host "  ✓ FTL files in build output" -ForegroundColor Green
    } else {
        Write-Host "  ✗ FTL files missing in build output" -ForegroundColor Red
        $errors++
    }
    
    # 检查构建产物中的 preferences.xhtml
    $builtXhtml = ".scaffold\build\addon\content\preferences.xhtml"
    $builtMissingPrefix = Select-String -Path $builtXhtml -Pattern 'data-l10n-id="(?!zoteroAIRreader-)[^"]+"'
    if ($builtMissingPrefix) {
        Write-Host "  ✗ Built XHTML has l10n-id without prefix" -ForegroundColor Red
        $errors++
    } else {
        Write-Host "  ✓ Built XHTML has correct l10n-id" -ForegroundColor Green
    }
} else {
    Write-Host "  ✗ Build failed" -ForegroundColor Red
    $errors++
}

# 总结
Write-Host ""
Write-Host "=== Validation Summary ===" -ForegroundColor Cyan
if ($errors -eq 0) {
    Write-Host "✓ All checks passed! Ready to release." -ForegroundColor Green
    exit 0
} else {
    Write-Host "✗ $errors error(s) found. Fix before releasing." -ForegroundColor Red
    exit 1
}
