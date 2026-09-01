# Deploiement du portfolio sur Proxmox

Le site est un build **Astro statique** (aucun adapter SSR) : la prod ne fait
tourner que nginx, Node ne sert qu'a builder. Traefik (LXC 102) termine le TLS
et route vers le LXC portfolio par son IP LAN, comme pour roissyshare.

```
Internet -> Traefik (LXC 102, websecure + CrowdSec) -> http://<IP LXC>:80 -> nginx -> /var/www/portfolio/current
```

## 1. Creer le LXC (depuis le shell du noeud `serveur`)

```sh
pveam update
pveam download local debian-12-standard_12.12-1_amd64.tar.zst

pct create 105 local:vztmpl/debian-12-standard_12.12-1_amd64.tar.zst \
  --hostname portfolio \
  --cores 1 --memory 1024 --swap 512 \
  --rootfs local-zfs:8 \
  --net0 name=eth0,bridge=vmbr0,ip=192.168.1.105/24,gw=192.168.1.1 \
  --nameserver 1.1.1.1 \
  --unprivileged 1 --onboot 1 \
  --password

pct start 105
```

Debian 12 (bookworm) plutot que 13 : c'est la derniere version pour laquelle le
depot NodeSource publie un paquet Node 22 sans bricolage.

IP `192.168.1.105` : libre, hors plage DHCP (qui distribue de .10 a ~.29) et
alignee sur la convention existante (LXC 103 -> .103, noeud -> .100). Si tu la
changes, la reporter dans
`deploy/traefik/portfolio.yml` et dans `set_real_ip_from` de `deploy/nginx.conf`
(qui doit contenir l'IP du LXC 102, pas celle du portfolio).

## 2. Provisionner le conteneur

```sh
pct exec 105 -- bash -c "apt-get update && apt-get install -y git && \
  git clone https://github.com/H3Dylan/Portfolio.git /opt/portfolio && \
  /opt/portfolio/deploy/setup-lxc.sh"
```

Le script installe Node 22 + nginx, pose le vhost, build et publie la premiere
release. Verification locale :

```sh
pct exec 105 -- curl -sI http://localhost/ | head -1
```

## 3. Brancher Traefik (LXC 102)

```sh
cp portfolio.yml /opt/traefik/config/portfolio.yml
```

Le provider file est recharge a chaud, aucun restart. Verifier ensuite dans le
dashboard Traefik que `portfolio-router@file` est bien `Success`.

## 4. DNS

Deux enregistrements **A** vers l'IP publique de la box :

| Nom                    | Type | Valeur          |
| ---------------------- | ---- | --------------- |
| `dylanbouillon.fr`     | A    | IP publique     |
| `www.dylanbouillon.fr` | A    | IP publique     |

Les deux doivent resoudre avant le premier acces, sinon le challenge TLS-ALPN-01 de
Let's Encrypt echoue -- il se joue sur le **443** (`leresolver.acme.tlschallenge=true`),
donc c'est ce port qui doit etre redirige vers le LXC 102 depuis la box. `www`
sert uniquement a rediriger vers l'apex (301).

## 5. Mettre a jour le site

Apres un `git push` sur `main` :

```sh
pct exec 105 -- /opt/portfolio/deploy/deploy.sh
```

Le script fait `fetch` + `reset --hard origin/main`, rebuild, publie dans
`/var/www/portfolio/releases/<date>-<sha>` et bascule le symlink `current` par un
`rename(2)` atomique : aucune requete ne tombe sur un dossier a moitie copie.
Les 5 dernieres releases sont conservees.

### Rollback

```sh
ln -sfn /var/www/portfolio/releases/<release-precedente> /var/www/portfolio/current.tmp
mv -T /var/www/portfolio/current.tmp /var/www/portfolio/current
systemctl reload nginx
```

### Deploiement automatique (optionnel)

Pour un rebuild quotidien sans intervention, dans le conteneur :

```sh
systemd-run --on-calendar='daily' --unit=portfolio-deploy /opt/portfolio/deploy/deploy.sh
```

## Fichiers

| Fichier                      | Destination                                |
| ---------------------------- | ------------------------------------------ |
| `setup-lxc.sh`               | execute une fois dans le LXC               |
| `deploy.sh`                  | `/opt/portfolio/deploy/deploy.sh`          |
| `nginx.conf`                 | `/etc/nginx/sites-available/portfolio`     |
| `traefik/portfolio.yml`      | `/opt/traefik/config/portfolio.yml` (LXC 102) |
