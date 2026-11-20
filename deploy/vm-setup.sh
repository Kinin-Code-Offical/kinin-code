#!/usr/bin/env bash
# One-time setup for a fresh Debian 12 VM (run as root via deploy.ps1 -Setup).
# Installs Node.js 22 LTS, Caddy, a 2 GB swap file and the systemd service.
set -euo pipefail

DEPLOY_DIR=/tmp/kinin-deploy
APP_DIR=/opt/kinin-code

# Swap: the e2-micro has 1 GB RAM.
if ! swapon --show | grep -q /swapfile; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y curl ca-certificates gnupg debian-keyring debian-archive-keyring apt-transport-https unattended-upgrades

# Node.js 22 LTS (official NodeSource repository).
if ! command -v node >/dev/null || ! node -v | grep -q '^v22'; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi

# Caddy (official repository).
if ! command -v caddy >/dev/null; then
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update
  apt-get install -y caddy
fi

# App user and directories.
id kinin >/dev/null 2>&1 || useradd --system --home "$APP_DIR" --shell /usr/sbin/nologin kinin
mkdir -p "$APP_DIR/releases"
touch "$APP_DIR/.env"
chown -R kinin:kinin "$APP_DIR"
chmod 600 "$APP_DIR/.env"

install -m 644 "$DEPLOY_DIR/kinin-code.service" /etc/systemd/system/kinin-code.service
install -m 644 "$DEPLOY_DIR/Caddyfile" /etc/caddy/Caddyfile
systemctl daemon-reload
systemctl enable kinin-code caddy
systemctl restart caddy

echo "setup done: node $(node -v), $(caddy version | head -1)"
