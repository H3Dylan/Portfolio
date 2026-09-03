# Plan d'adressage du homelab

Etabli le 2026-09-01, mis a jour le 2026-09-02 (migration de roissyshare vers
un LXC). Toutes les machines Proxmox sont en **IP statique** (configuree cote
Proxmox / invite), aucune ne depend du DHCP de la Livebox.

## Convention

**Dernier octet = VMID Proxmox.**

| IP | Machine | Type | Configure par |
| --- | --- | --- | --- |
| `.1` | Livebox | passerelle | - |
| `.100` | noeud `serveur` | hyperviseur | `/etc/network/interfaces` |
| `.101` | LXC 101 wireguard-vpn | LXC | `pct set` |
| `.102` | LXC 102 reverse-proxy | LXC | `pct set` |
| `.103` | LXC 103 monitoring | LXC | `pct set` |
| `.104` | LXC 104 archipelago | LXC | `pct set` |
| `.105` | LXC 105 portfolio | LXC | `pct set` |
| `.106` | LXC 106 roissyshare | LXC | `pct set` |

Aucune exception : la convention est reguliere. La VM 100 (web-server), qui
portait roissyshare en `.110`, a ete migree vers le LXC 106 le 2026-09-02 puis
detruite le 2026-09-03. Ses sauvegardes quotidiennes restent dans
`/var/lib/vz/dump` si un retour arriere devenait necessaire.

Le `.100` de l'hyperviseur interdit d'utiliser le VMID 100 pour une machine :
en creer une prendrait le prochain ID libre.

## Plage DHCP

Livebox : **`.10` -> `.99`** (reduite depuis `.150` le 2026-09-01).

La zone `.100`-`.254` est reservee aux statiques : la box ne peut plus y
attribuer d'adresse, donc aucun conflit possible. **Ne pas elargir la plage
au-dela de `.99`.**

## Regles NAT/PAT Livebox

| Service | Port | Proto | Cible |
| --- | --- | --- | --- |
| Wireguard | 51820 | UDP | `192.168.1.101` |
| HTTPTraefik | 80 | TCP | `192.168.1.102` |
| HTTPSTraefik | 443 | TCP | `192.168.1.102` |

Seules ces trois machines sont joignables depuis Internet. Tout le reste
transite par Traefik, qui route sur le `Host` HTTP.

## Piege Livebox : IP statique et NAT

La Livebox stocke ses regles NAT par **nom d'equipement**, qu'elle resout via
sa table DHCP. Quand une machine passe en IP statique pure, elle disparait de
cette table et **la regle se fige sur la derniere IP connue** — silencieusement.
Symptome : le service devient injoignable de l'exterieur alors que tout
fonctionne en local.

**Procedure a suivre pour toute machine recevant du NAT :**

1. Passer la machine en IP statique (`pct set ... ip=192.168.1.X/24,gw=192.168.1.1`)
2. Dans la Livebox, onglet NAT/PAT : **supprimer** la regle existante
3. La **recreer** avec le menu deroulant Equipement -> `nouveau...` -> saisir
   l'IP a la main
4. Supprimer l'eventuel bail DHCP statique devenu inutile (onglet DHCP)
5. Tester **depuis l'exterieur** (4G, Wi-Fi coupe) — un test depuis le LAN ne
   prouve rien

## Ne pas oublier en changeant une IP

- **DNS de l'invite** : en DHCP il venait du bail. En statique il faut le poser
  (`pct set <id> -nameserver 192.168.1.1`, ou `/etc/resolv.conf` pour une VM).
- **Cibles Traefik** : `grep -H 'url:' /opt/traefik/config/*.yml` sur le LXC 102.
- **`set_real_ip_from`** des nginx en aval : doit pointer vers `192.168.1.102`.
- **Docker** : verifier qu'aucun conteneur n'est binde sur l'ancienne IP
  (`docker ps --format '{{.Names}} {{.Ports}}'`), `0.0.0.0` est sans risque.
- **Conteneurs Docker** : ils heritent du `/etc/resolv.conf` de l'hote au
  demarrage — les redemarrer apres avoir corrige le DNS.

## DNS public

Zone geree chez **Infomaniak** (`ns11`/`ns12.infomaniak.ch`).
IP publique : `83.204.159.47`.

Un enregistrement **wildcard** `*.dylanbouillon.fr` (A) couvre tous les
sous-domaines : **aucun enregistrement a creer** pour un nouveau service, il
suffit d'ajouter son router dans `/opt/traefik/config/`.
