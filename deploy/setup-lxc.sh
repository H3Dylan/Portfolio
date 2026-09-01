#!/usr/bin/env bash
# Provisionne un LXC Debian vierge pour heberger le portfolio.
# A executer une seule fois, en root, DANS le conteneur.
set -euo pipefail

REPO_URL="https://github.com/H3Dylan/Portfolio.git"
REPO_DIR="/opt/portfolio"
WWW_DIR="/var/www/portfolio"

log() { printf '\033[1;34m==>\033[0m %s\n' "$1"; }

log "Paquets de base"
apt-get update
apt-get install -y curl git nginx ca-certificates gnupg

log "Node.js 22 (package.json exige >= 22.12)"
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs

log "Clonage du repo"
if [ -d "$REPO_DIR/.git" ]; then
  git -C "$REPO_DIR" fetch --prune origin
else
  git clone "$REPO_URL" "$REPO_DIR"
fi

log "Arborescence de publication"
mkdir -p "${WWW_DIR}/releases"

log "Vhost nginx"
cp "$REPO_DIR/deploy/nginx.conf" /etc/nginx/sites-available/portfolio
ln -sfn /etc/nginx/sites-available/portfolio /etc/nginx/sites-enabled/portfolio
rm -f /etc/nginx/sites-enabled/default

log "Activation de nginx"
systemctl enable --now nginx

log "Premier deploiement"
"$REPO_DIR/deploy/deploy.sh"

log "Termine. Verifier avec : curl -I http://localhost/"
