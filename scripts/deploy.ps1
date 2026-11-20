<#
.SYNOPSIS
  Builds kinin-code.dev and deploys it to the Compute Engine VM.

.EXAMPLE
  # first time (installs Node, Caddy, systemd unit on the VM), then deploy
  powershell -ExecutionPolicy Bypass -File scripts/deploy.ps1 -Setup

.EXAMPLE
  # every later deploy
  powershell -ExecutionPolicy Bypass -File scripts/deploy.ps1
#>
param(
  [string]$Instance = "kinin-code",
  [string]$Zone = "us-east1-b",
  [string]$Project = "",
  [switch]$Setup,
  [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root

$gcloudArgs = @("--zone", $Zone)
if ($Project) { $gcloudArgs += @("--project", $Project) }

if (-not $SkipBuild) {
  Write-Host "==> Building (NEXT_PUBLIC_SITE_URL=https://kinin-code.dev)"
  $env:NEXT_PUBLIC_SITE_URL = "https://kinin-code.dev"
  & node node_modules/next/dist/bin/next build
  if ($LASTEXITCODE -ne 0) { throw "next build failed" }
}

$stamp = Get-Date -Format "yyyyMMddHHmmss"
$stage = Join-Path $env:TEMP "kinin-release-$stamp"
$bundle = Join-Path $env:TEMP "kinin-release-$stamp.tgz"

Write-Host "==> Staging standalone bundle"
Copy-Item -Recurse ".next/standalone" $stage
New-Item -ItemType Directory -Force (Join-Path $stage ".next") | Out-Null
Copy-Item -Recurse ".next/static" (Join-Path $stage ".next/static")
Copy-Item -Recurse "public" (Join-Path $stage "public")
# Windows-only native image binaries are useless on Linux (next/image is not used).
foreach ($native in @("node_modules/sharp", "node_modules/@img")) {
  $path = Join-Path $stage $native
  if (Test-Path $path) { Remove-Item -Recurse -Force $path }
}

Write-Host "==> Packing"
& tar -czf $bundle -C $stage .
if ($LASTEXITCODE -ne 0) { throw "tar failed" }

Write-Host "==> Uploading to $Instance"
& gcloud compute ssh $Instance @gcloudArgs --command "mkdir -p /tmp/kinin-deploy"
if ($LASTEXITCODE -ne 0) { throw "ssh failed" }
$files = @($bundle, "deploy/Caddyfile", "deploy/kinin-code.service", "deploy/vm-setup.sh", "deploy/release.sh")
& gcloud compute scp @files "${Instance}:/tmp/kinin-deploy/" @gcloudArgs
if ($LASTEXITCODE -ne 0) { throw "scp failed" }
$remoteBundle = Split-Path $bundle -Leaf
$remote = "mv /tmp/kinin-deploy/$remoteBundle /tmp/kinin-deploy/release.tgz"
if ($Setup) { $remote += " && sudo bash /tmp/kinin-deploy/vm-setup.sh" }
$remote += " && sudo bash /tmp/kinin-deploy/release.sh $stamp"

Write-Host "==> Installing release $stamp"
& gcloud compute ssh $Instance @gcloudArgs --command $remote
if ($LASTEXITCODE -ne 0) { throw "remote install failed" }

Remove-Item -Recurse -Force $stage
Remove-Item -Force $bundle
Write-Host "==> Done: https://kinin-code.dev"
