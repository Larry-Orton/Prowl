#Requires -Version 5.1
<#
.SYNOPSIS
  PROWL — One-command installer for Windows
.DESCRIPTION
  Installs Prowl and all dependencies. Run in PowerShell:
    irm https://raw.githubusercontent.com/Larry-Orton/Prowl/main/scripts/install.ps1 | iex
#>

$ErrorActionPreference = "Stop"
$REPO = "https://github.com/Larry-Orton/Prowl.git"
$INSTALL_DIR = "$env:USERPROFILE\prowl"
$MIN_NODE = 18

function Write-Header {
    Write-Host ""
    Write-Host "  +===========================================+" -ForegroundColor Cyan
    Write-Host "  |          PROWL  INSTALLER                 |" -ForegroundColor Cyan
    Write-Host "  |   intelligent pentester terminal          |" -ForegroundColor Cyan
    Write-Host "  +===========================================+" -ForegroundColor Cyan
    Write-Host ""
}

function Write-Step($msg) { Write-Host "  [*] $msg" -ForegroundColor Green }
function Write-Info($msg) { Write-Host "  [i] $msg" -ForegroundColor DarkGray }
function Write-Err($msg) { Write-Host "  [!] $msg" -ForegroundColor Red }

Write-Header

# ── Check / install winget or choco ──────────────────
$hasWinget = Get-Command winget -ErrorAction SilentlyContinue
$hasChoco = Get-Command choco -ErrorAction SilentlyContinue

function Install-WithPackageManager($wingetId, $chocoId, $name) {
    if ($hasWinget) {
        Write-Info "Installing $name via winget..."
        winget install --id $wingetId --accept-source-agreements --accept-package-agreements -e
    } elseif ($hasChoco) {
        Write-Info "Installing $name via choco..."
        choco install $chocoId -y
    } else {
        Write-Err "Cannot auto-install $name. Please install winget or chocolatey first."
        Write-Err "  winget: comes with Windows 11 / App Installer from Microsoft Store"
        Write-Err "  choco:  https://chocolatey.org/install"
        exit 1
    }
    # Refresh PATH
    $env:PATH = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
}

# ── Check / install git ─────────────────────────────
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Install-WithPackageManager "Git.Git" "git" "Git"
}
Write-Step "git $(git --version 2>&1)"

# ── Check / install Node.js ─────────────────────────
$nodeOk = $false
if (Get-Command node -ErrorAction SilentlyContinue) {
    $nodeVer = (node -v) -replace 'v', '' -split '\.' | Select-Object -First 1
    if ([int]$nodeVer -ge $MIN_NODE) {
        $nodeOk = $true
    } else {
        Write-Info "Node.js v$nodeVer found but v$MIN_NODE+ required."
    }
}

if (-not $nodeOk) {
    Install-WithPackageManager "OpenJS.NodeJS.LTS" "nodejs-lts" "Node.js"
}
Write-Step "node $(node -v 2>&1)"

# ── Check / install build tools (for node-pty) ──────
# node-gyp on Windows needs Visual Studio Build Tools
$vsWhere = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe"
$hasBuildTools = $false
if (Test-Path $vsWhere) {
    $vs = & $vsWhere -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath 2>$null
    if ($vs) { $hasBuildTools = $true }
}

if (-not $hasBuildTools) {
    Write-Info "Installing Visual Studio Build Tools (needed for native modules)..."
    if ($hasWinget) {
        winget install --id Microsoft.VisualStudio.2022.BuildTools --accept-source-agreements --accept-package-agreements -e --override "--quiet --wait --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"
    } elseif ($hasChoco) {
        choco install visualstudio2022buildtools -y --package-parameters "--add Microsoft.VisualStudio.Workload.VCTools --includeRecommended --passive"
    } else {
        Write-Err "Cannot auto-install C++ Build Tools."
        Write-Err "Please install Visual Studio Build Tools manually:"
        Write-Err "  https://visualstudio.microsoft.com/visual-cpp-build-tools/"
        exit 1
    }
}
Write-Step "C++ build tools"

# ── Clone or update repo ────────────────────────────
if (Test-Path "$INSTALL_DIR\.git") {
    Write-Info "Updating existing Prowl installation..."
    Push-Location $INSTALL_DIR
    git pull --ff-only
    Pop-Location
} else {
    Write-Info "Cloning Prowl..."
    git clone $REPO $INSTALL_DIR
}
Write-Step "source code"

# ── Run setup ───────────────────────────────────────
Push-Location $INSTALL_DIR
Write-Host ""
Write-Host "  Running Prowl setup..." -ForegroundColor White
npm run setup

# ── Build ───────────────────────────────────────────
Write-Host ""
Write-Host "  Building Prowl..." -ForegroundColor White
npm run build
Pop-Location

# ── Done ────────────────────────────────────────────
Write-Host ""
Write-Host "  ===========================================" -ForegroundColor Green
Write-Host "    PROWL installed successfully!" -ForegroundColor Green
Write-Host "  ===========================================" -ForegroundColor Green
Write-Host ""
Write-Host "  To start Prowl:" -ForegroundColor White
Write-Host "    cd $INSTALL_DIR; npm run electron:dev" -ForegroundColor Gray
Write-Host ""
Write-Host "  Or build a packaged installer:" -ForegroundColor White
Write-Host "    cd $INSTALL_DIR; npm run electron:build" -ForegroundColor Gray
Write-Host ""
