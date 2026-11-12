param(
  [string]$BaseUrl = 'http://127.0.0.1:5001',
  [string]$RequestPath = (Join-Path $PSScriptRoot 'presenton-request.json')
)

if (-not $env:PRESENTON_API_KEY) {
  throw 'Set PRESENTON_API_KEY to an API key created in your local Presenton instance. No key is stored in this repository.'
}

$payload = Get-Content -LiteralPath $RequestPath -Raw -Encoding UTF8
Invoke-RestMethod -Method Post `
  -Uri "$BaseUrl/api/v1/ppt/presentation/generate" `
  -Headers @{ Authorization = "Bearer $env:PRESENTON_API_KEY" } `
  -ContentType 'application/json' `
  -Body $payload
