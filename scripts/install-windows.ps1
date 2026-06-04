$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$sourceDir = Join-Path $projectRoot "dist\win-unpacked"
$installer = Join-Path $projectRoot "dist\typi-setup.exe"
$installDir = Join-Path $env:LOCALAPPDATA "Programs\Typi"
$configDir = Join-Path $env:APPDATA "typi"
$configPath = Join-Path $configDir "config.json"
$defaultVaultPath = Join-Path (Join-Path $env:USERPROFILE "Documents") "Typi Vault"
$vaultPath = $defaultVaultPath
if (Test-Path $configPath) {
  try {
    $existingConfig = Get-Content -Path $configPath -Raw | ConvertFrom-Json
    if ($existingConfig.vaultPath) {
      $vaultPath = $existingConfig.vaultPath
    }
  } catch {
    $vaultPath = $defaultVaultPath
  }
}
$notesFolder = Join-Path $vaultPath "Typi Notes"
$desktop = [Environment]::GetFolderPath("Desktop")
$startMenu = Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs"

function Write-Utf8NoBom($path, $content) {
  $encoding = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($path, $content, $encoding)
}

if (-not (Test-Path $sourceDir)) {
  Write-Host "Building Typi..."
  Push-Location $projectRoot
  npm run build:win | Out-Host
  Pop-Location
}

if (-not (Test-Path $sourceDir)) {
  throw "Build output missing: $sourceDir"
}

Write-Host "Installing Typi to $installDir"
if (Test-Path $installDir) {
  Remove-Item $installDir -Recurse -Force
}
New-Item -ItemType Directory -Force -Path $installDir | Out-Null
Copy-Item -Path (Join-Path $sourceDir "*") -Destination $installDir -Recurse -Force

$exePath = Join-Path $installDir "Typi.exe"
if (-not (Test-Path $exePath)) {
  throw "Typi.exe not found after copy"
}

function New-Shortcut($shortcutPath, $targetPath) {
  $shell = New-Object -ComObject WScript.Shell
  $shortcut = $shell.CreateShortcut($shortcutPath)
  $shortcut.TargetPath = $targetPath
  $shortcut.WorkingDirectory = Split-Path $targetPath
  $shortcut.IconLocation = "$targetPath,0"
  $shortcut.Save()
}

New-Shortcut (Join-Path $desktop "Typi.lnk") $exePath
New-Item -ItemType Directory -Force -Path $startMenu | Out-Null
New-Shortcut (Join-Path $startMenu "Typi.lnk") $exePath

Write-Host "Creating Obsidian vault at $vaultPath"
New-Item -ItemType Directory -Force -Path $notesFolder | Out-Null
$obsidianDir = Join-Path $vaultPath ".obsidian"
New-Item -ItemType Directory -Force -Path $obsidianDir | Out-Null

$appJson = Join-Path $obsidianDir "app.json"
if (-not (Test-Path $appJson)) {
  '{"legacyEditor":false,"livePreview":true}' | Set-Content -Path $appJson -Encoding UTF8
}

$appearanceJson = Join-Path $obsidianDir "appearance.json"
if (-not (Test-Path $appearanceJson)) {
  '{"theme":"moonstone"}' | Set-Content -Path $appearanceJson -Encoding UTF8
}

$corePluginsJson = Join-Path $obsidianDir "core-plugins.json"
if (-not (Test-Path $corePluginsJson)) {
  '["file-explorer","global-search","switcher","graph","backlink","page-preview","daily-notes","templates","note-composer","editor-status"]' |
    Set-Content -Path $corePluginsJson -Encoding UTF8
}

$welcome = Join-Path $vaultPath "Welcome to Typi.md"
if (-not (Test-Path $welcome)) {
@'
# Welcome to Typi Vault

Notes saved from **Typi** are stored in `Typi Notes/`.

Open this folder in Obsidian with **Open folder as vault**.
'@ | Set-Content -Path $welcome -Encoding UTF8
}

New-Item -ItemType Directory -Force -Path $configDir | Out-Null
Write-Utf8NoBom $configPath (@{ vaultPath = $vaultPath } | ConvertTo-Json)

$obsidianExe = @(
  (Join-Path $env:LOCALAPPDATA "Programs\Obsidian\Obsidian.exe"),
  (Join-Path $env:LOCALAPPDATA "Obsidian\Obsidian.exe"),
  "$env:LOCALAPPDATA\Programs\Obsidian\Obsidian.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1

Write-Host ""
Write-Host "Installed."
Write-Host "  Typi: $exePath"
Write-Host "  Vault: $vaultPath"
Write-Host "  Notes folder: $notesFolder"

if ($obsidianExe) {
  Write-Host "Opening vault in Obsidian..."
  Start-Process -FilePath $obsidianExe -ArgumentList "`"$vaultPath`""
} else {
  Write-Host "Obsidian not found - opening the official Obsidian download page."
  Start-Process "https://obsidian.md/download"
}

Start-Process -FilePath $exePath
