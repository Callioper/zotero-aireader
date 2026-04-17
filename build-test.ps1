$ErrorActionPreference = 'Continue'
$env:__env__ = '"production"'

$projectRoot = "D:\ai-reader-zotero-plugin"
$esbuildExe = "$projectRoot\node_modules\.bin\esbuild"

# Create output directory
$outputDir = "$projectRoot\.scaffold\build\addon\content\scripts"
if (-not (Test-Path $outputDir)) {
    New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
}

# Run esbuild
& $esbuildExe "$projectRoot\src\index.ts" `
    --bundle `
    --target=firefox115 `
    --outfile="$outputDir\zoteroAIRreader.js" `
    --define:__env=$env:__env `
    --external:zotero-plugin-toolkit

Write-Host "Build completed"
