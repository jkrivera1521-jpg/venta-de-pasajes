param([string]$BaseUrl = "http://localhost:8088")
$ErrorActionPreference = "Stop"
$health = Invoke-RestMethod -Uri "$BaseUrl/api/v1/report/health" -Method Get
$health | ConvertTo-Json -Compress
