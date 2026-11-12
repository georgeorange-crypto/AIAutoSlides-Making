param(
  [ValidateSet('core','documents','diagrams','research','all')]
  [string]$Profile = 'core',
  [switch]$SkipChecks
)

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location $root

function Invoke-Checked([string]$Command, [string[]]$Arguments) {
  Write-Host "> $Command $($Arguments -join ' ')"
  & $Command @Arguments
  if ($LASTEXITCODE -ne 0) { throw "Command failed with exit code ${LASTEXITCODE}: $Command $($Arguments -join ' ')" }
}

$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) { throw 'Node.js 22.5+ is required. Install the current Node.js LTS release, reopen PowerShell, and rerun this script; or use Docker Compose.' }
$nodeVersion = (node --version).Trim().TrimStart('v')
try { $parsedVersion = [version]$nodeVersion } catch { throw "Could not parse Node.js version '$nodeVersion'. Install Node.js 22.5+ and retry." }
if ($parsedVersion -lt [version]'22.5.0') { throw "Node.js $nodeVersion is too old. Install Node.js 22.5+ and rerun setup." }
$npmCommand = if (Get-Command npm.cmd -ErrorAction SilentlyContinue) { 'npm.cmd' } elseif (Get-Command npm -ErrorAction SilentlyContinue) { 'npm' } else { throw 'npm was not found on PATH. Reinstall Node.js with npm enabled, reopen PowerShell, and rerun setup.' }

Write-Host "Using Node.js $nodeVersion"
Invoke-Checked $npmCommand @('ci','--no-audit','--no-fund')
Invoke-Checked $npmCommand @('run','deps')

if ($Profile -in @('documents','all')) { Invoke-Checked $npmCommand @('run','deps:markitdown') }
if ($Profile -in @('diagrams','all')) { Invoke-Checked $npmCommand @('ci','--prefix','workers/mermaid','--no-audit','--no-fund') }
if ($Profile -in @('research','all')) {
  Invoke-Checked powershell.exe @('-NoProfile','-ExecutionPolicy','Bypass','-File',(Join-Path $root 'workers/research/install.ps1'))
}

if (-not $SkipChecks) {
  Invoke-Checked $npmCommand @('run','test')
  Invoke-Checked $npmCommand @('run','validate')
}

$office = Get-Command soffice -ErrorAction SilentlyContinue
$poppler = Get-Command pdftoppm -ErrorAction SilentlyContinue
$powerPoint = Get-Command powerpnt.exe -ErrorAction SilentlyContinue
$runningOnWindows = $env:OS -eq 'Windows_NT'
if (-not $office -and -not ($runningOnWindows -and $powerPoint)) { Write-Warning 'PowerPoint/LibreOffice was not found; the PPTX build works, but PDF preview needs one. Docker Compose includes LibreOffice.' }
if (-not $poppler) { Write-Warning 'Poppler pdftoppm was not found; page PNG previews need Poppler. Docker Compose includes it.' }

Write-Host "Setup complete (profile: $Profile). Use 'npm run build' to generate the sample PPTX."
Write-Host 'Optional AI providers, model weights, Slidev/PPTAgent runtimes, and cloud credentials are not installed or configured by this script.'
