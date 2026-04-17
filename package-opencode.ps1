$ErrorActionPreference = 'Continue'
$dest = "D:\ai-reader-zotero-plugin\opencode-transfer.zip"
$src = @(
    "D:\ai-reader-zotero-plugin",
    "D:\opencode\Zotero插件开发工作指南.md",
    "C:\Users\Administrator\.config\opencode\skills"
)
try {
    Compress-Archive -Path $src -DestinationPath $dest -Force -ErrorAction Stop
    $file = Get-Item $dest
    $sizeMB = [math]::Round($file.Length/1MB,2)
    Write-Host "Created: $($file.Name)"
    Write-Host "Size: ${sizeMB} MB"
} catch {
    Write-Host "Error: $_"
}
