#!/usr/bin/env bash
# Installe le runner GitHub Actions self-hosted dans le LXC du portfolio.
# A executer une seule fois, en root, DANS le conteneur 105.
#
# Usage : ./setup-runner.sh <TOKEN>
#
# Le token se recupere sur GitHub :
#   Settings > Actions > Runners > New self-hosted runner > Linux x64
# Il est ephemere (valable ~1h) et ne sert qu'a l'enregistrement.
set -euo pipefail

TOKEN="${1:?Usage: setup-runner.sh <TOKEN>}"
REPO_URL="https://github.com/H3Dylan/Portfolio"
RUNNER_DIR="/opt/actions-runner"
RUNNER_USER="runner"

log() { printf '\033[1;34m==>\033[0m %s\n' "$1"; }

log "Dependances"
apt-get update
apt-get install -y curl jq tar

log "Utilisateur dedie (le runner refuse de tourner en root)"
id -u "$RUNNER_USER" >/dev/null 2>&1 || useradd -m -s /bin/bash "$RUNNER_USER"

log "Telechargement du runner"
VERSION="$(curl -fsSL https://api.github.com/repos/actions/runner/releases/latest \
  | jq -r .tag_name | sed 's/^v//')"
mkdir -p "$RUNNER_DIR"
chown "$RUNNER_USER:$RUNNER_USER" "$RUNNER_DIR"
cd "$RUNNER_DIR"
sudo -u "$RUNNER_USER" curl -fsSL -o runner.tar.gz \
  "https://github.com/actions/runner/releases/download/v${VERSION}/actions-runner-linux-x64-${VERSION}.tar.gz"
sudo -u "$RUNNER_USER" tar xzf runner.tar.gz
rm -f runner.tar.gz

log "Dependances systeme du runner"
./bin/installdependencies.sh

log "Enregistrement aupres de GitHub"
sudo -u "$RUNNER_USER" ./config.sh \
  --unattended \
  --url "$REPO_URL" \
  --token "$TOKEN" \
  --name portfolio-lxc \
  --labels self-hosted,linux,x64,portfolio \
  --work _work \
  --replace

log "Droit sudo limite au seul script de deploiement"
# Le runner n'est pas root ; deploy.sh a besoin d'ecrire dans /var/www et de
# recharger nginx. On n'accorde donc QUE cette commande, rien d'autre.
cat > /etc/sudoers.d/runner-deploy <<'SUDOERS'
runner ALL=(root) NOPASSWD: /opt/portfolio/deploy/deploy.sh
SUDOERS
chmod 440 /etc/sudoers.d/runner-deploy
visudo -cf /etc/sudoers.d/runner-deploy

log "Service systemd"
./svc.sh install "$RUNNER_USER"
./svc.sh start

log "Termine. Statut : cd ${RUNNER_DIR} && ./svc.sh status"
