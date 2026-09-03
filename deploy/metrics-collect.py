#!/usr/bin/env python3
"""Releve les metriques du homelab et les depose dans le conteneur du portfolio.

Tourne sur le noeud Proxmox, ou `pvesh` repond sans authentification puisqu'on
est deja root. Le fichier est ensuite pousse dans le LXC du site avec `pct
push`, ce qui evite d'installer un jeton d'API sur le serveur web et de publier
quoi que ce soit de l'hyperviseur sur le reseau.

Le JSON est depose hors du dossier de release : `deploy.sh` bascule un symlink
a chaque livraison et emporterait le fichier avec lui.
"""

import datetime
import json
import os
import subprocess
import tempfile

CONTENEUR_SITE = "105"
DESTINATION = "/var/www/portfolio/metrics.json"
# Les seuls conteneurs representes sur le schema du site.
PUBLIES = {"101", "102", "103", "104", "105", "106"}


def pvesh(chemin):
    sortie = subprocess.check_output(
        ["pvesh", "get", chemin, "--output-format", "json"], text=True
    )
    return json.loads(sortie)


def pourcent(utilise, total):
    return round(100.0 * utilise / total, 1) if total else 0.0


def duree(secondes):
    jours, reste = divmod(int(secondes), 86400)
    return "{}j {:02d}h".format(jours, reste // 3600)


def main():
    noeud = subprocess.check_output(["hostname"], text=True).strip()
    etat = pvesh("/nodes/{}/status".format(noeud))
    conteneurs = pvesh("/nodes/{}/lxc".format(noeud))

    releve = {
        "releve": datetime.datetime.now(datetime.timezone.utc)
        .replace(microsecond=0)
        .isoformat()
        .replace("+00:00", "Z"),
        "noeud": {
            "cpu": round(100.0 * etat.get("cpu", 0), 1),
            "cpus": etat.get("cpuinfo", {}).get("cpus", 0),
            "mem": pourcent(etat["memory"]["used"], etat["memory"]["total"]),
            "disk": pourcent(etat["rootfs"]["used"], etat["rootfs"]["total"]),
            "uptime": duree(etat.get("uptime", 0)),
        },
        "conteneurs": {},
    }

    for c in conteneurs:
        vmid = str(c.get("vmid"))
        if vmid not in PUBLIES:
            continue
        arrete = c.get("status") != "running"
        releve["conteneurs"][vmid] = {
            "cpu": 0.0 if arrete else round(100.0 * c.get("cpu", 0), 1),
            "cpus": c.get("cpus", 0),
            "mem": 0.0 if arrete else pourcent(c.get("mem", 0), c.get("maxmem", 0)),
            "disk": pourcent(c.get("disk", 0), c.get("maxdisk", 0)),
            "uptime": duree(c.get("uptime", 0)),
            "statut": c.get("status", "inconnu"),
        }

    fd, temporaire = tempfile.mkstemp(prefix="metrics-", suffix=".json")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(releve, f, ensure_ascii=False)
        # Ecriture en deux temps : un lecteur ne doit jamais tomber sur un
        # fichier a moitie ecrit.
        provisoire = DESTINATION + ".tmp"
        subprocess.run(
            ["pct", "push", CONTENEUR_SITE, temporaire, provisoire, "--perms", "644"],
            check=True,
        )
        subprocess.run(
            ["pct", "exec", CONTENEUR_SITE, "--", "mv", provisoire, DESTINATION],
            check=True,
        )
    finally:
        os.unlink(temporaire)

    print("{} conteneurs releves, depose dans le LXC {}".format(
        len(releve["conteneurs"]), CONTENEUR_SITE))


if __name__ == "__main__":
    main()
