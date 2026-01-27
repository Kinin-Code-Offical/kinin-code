param(
  [switch]$DevTools
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host "[dev] Project: $root"
Write-Host "[dev] Node: $(node -v)"
Write-Host "[dev] NPM: $(npm -v)"

if (!(Test-Path -Path "node_modules")) {
  Write-Host "[dev] Installing dependencies..."
  npm install
}

if ($DevTools -or $true) {
  $env:NEXT_PUBLIC_DEVTOOLS = "1"
}

$url = "http://localhost:3000/?dev=1"
Write-Host "[dev] Opening $url"
Start-Process $url

Write-Host "[dev] Starting Next.js..."
npm run dev
