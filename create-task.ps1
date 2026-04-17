$action = New-ScheduledTaskAction -Execute "C:\Python311\python.exe" -Argument "-m uvicorn src.main:app --host 127.0.0.1 --port 8765" -WorkingDirectory "D:\ai-reader-zotero-plugin\service"
$trigger = New-ScheduledTaskTrigger -AtStartup
Register-ScheduledTask -TaskName "ZoteroAIRService" -Action $action -Trigger $trigger -Description "Zotero AI Reader Backend" -Force
Write-Host "Task created successfully!"
