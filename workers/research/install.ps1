$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$venv = Join-Path $root '.venv\research'
$python = Join-Path $venv 'Scripts\python.exe'
if (-not (Test-Path $python)) {
  py -3.12 -m venv $venv
  if ($LASTEXITCODE -ne 0) { throw 'Python 3.12 venv creation failed.' }
}
& $python -m pip install --upgrade pip
if ($LASTEXITCODE -ne 0) { throw 'pip upgrade failed.' }
& $python -m pip install -r (Join-Path $PSScriptRoot 'requirements-lock.txt')
if ($LASTEXITCODE -ne 0) { throw 'Research dependency installation failed.' }
# Crawl4AI launches Playwright directly, so provision the matching local browser.
# This installs a local binary only; it does not configure a hosted LLM/API.
& $python -m playwright install chromium
if ($LASTEXITCODE -ne 0) { throw 'Playwright Chromium installation failed.' }
Write-Host "Set AIAUTOSLIDES_PYTHON=$python when using this runtime outside this checkout."
