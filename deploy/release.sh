#!/usr/bin/env bash
# Installs an uploaded release (run as root by deploy.ps1):
# unpack -> switch the "current" symlink -> restart -> health check -> prune.
set -euo pipefail

STAMP="${1:?release stamp required}"
DEPLOY_DIR=/tmp/kinin-deploy
APP_DIR=/opt/kinin-code
RELEASE="$APP_DIR/releases/$STAMP"

mkdir -p "$RELEASE"
tar -xzf "$DEPLOY_DIR/release.tgz" -C "$RELEASE"
chown -R kinin:kinin "$RELEASE"

# Keep the Caddy/systemd config in sync with the repository.
install -m 644 "$DEPLOY_DIR/kinin-code.service" /etc/systemd/system/kinin-code.service
if ! cmp -s "$DEPLOY_DIR/Caddyfile" /etc/caddy/Caddyfile; then
  install -m 644 "$DEPLOY_DIR/Caddyfile" /etc/caddy/Caddyfile
  systemctl reload caddy
fi
systemctl daemon-reload

PREVIOUS="$(readlink -f "$APP_DIR/current" 2>/dev/null || true)"
ln -sfn "$RELEASE" "$APP_DIR/current"
systemctl restart kinin-code

for i in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:3000/api/healthz >/dev/null 2>&1; then
    echo "release $STAMP is live"
    # Keep the three newest releases.
    ls -1dt "$APP_DIR"/releases/* | tail -n +4 | xargs -r rm -rf
    exit 0
  fi
  sleep 1
done

echo "health check failed, rolling back" >&2
if [ -n "$PREVIOUS" ] && [ -d "$PREVIOUS" ]; then
  ln -sfn "$PREVIOUS" "$APP_DIR/current"
  systemctl restart kinin-code
fi
journalctl -u kinin-code -n 40 --no-pager >&2
exit 1
