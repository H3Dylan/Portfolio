#!/usr/bin/env bash
# Deploie le portfolio sur le LXC : recupere main, rebuild, bascule la release.
# Usage : /opt/portfolio/deploy/deploy.sh
set -euo pipefail

REPO_DIR="/opt/portfolio"
WWW_DIR="/var/www/portfolio"
BRANCH="main"
KEEP_RELEASES=5

log() { printf '\033[1;34m==>\033[0m %s\n' "$1"; }

log "Recuperation de origin/${BRANCH}"
# Le conteneur depend d un resolveur DNS externe : une perte de paquets
# ponctuelle suffisait a faire echouer tout le deploiement sur un
# "Could not resolve host: github.com". Trois tentatives espacees.
for essai in 1 2 3; do
  if git -C "$REPO_DIR" fetch --prune origin; then
    break
  fi
  if [ "$essai" = 3 ]; then
    echo "Echec de la recuperation apres 3 tentatives" >&2
    exit 1
  fi
  log "Nouvelle tentative dans $((essai * 5))s"
  sleep $((essai * 5))
done
git -C "$REPO_DIR" reset --hard "origin/${BRANCH}"
REVISION="$(git -C "$REPO_DIR" rev-parse --short HEAD)"

log "Installation des dependances"
npm --prefix "$REPO_DIR" ci

log "Build Astro"
npm --prefix "$REPO_DIR" run build

RELEASE="${WWW_DIR}/releases/$(date +%Y%m%d-%H%M%S)-${REVISION}"
log "Publication de la release ${RELEASE##*/}"
mkdir -p "$RELEASE"
cp -a "$REPO_DIR/dist/." "$RELEASE/"

# Bascule atomique : rename(2) sur le symlink, aucune requete ne voit un etat vide
ln -sfn "$RELEASE" "${WWW_DIR}/current.tmp"
mv -T "${WWW_DIR}/current.tmp" "${WWW_DIR}/current"
chown -R www-data:www-data "$RELEASE"

log "Rechargement de nginx"
nginx -t
systemctl reload nginx

log "Nettoyage des anciennes releases (${KEEP_RELEASES} conservees)"
CURRENT="$(readlink -f "${WWW_DIR}/current")"
find "${WWW_DIR}/releases" -mindepth 1 -maxdepth 1 -type d \
  | sort -r | tail -n "+$((KEEP_RELEASES + 1))" \
  | while read -r old; do
      [ "$(readlink -f "$old")" = "$CURRENT" ] && continue
      rm -rf "$old"
    done

log "Deploiement termine : ${REVISION}"
