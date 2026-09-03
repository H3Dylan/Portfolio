import { useEffect, useRef, useState } from "react";

/** Fait monter un nombre de 0 vers sa valeur, en respectant la meme
 *  precision decimale que la cible pour eviter un "0.0" la ou on veut "0". */
function useCountUp(value: number, duration = 750) {
  const [shown, setShown] = useState(value);
  const frame = useRef(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(value);
      return;
    }
    const decimals = Number.isInteger(value) ? 0 : 1;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(Number((value * eased).toFixed(decimals)));
      if (p < 1) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [value, duration]);

  return shown;
}

type NodeId = "host" | "101" | "102" | "103" | "104" | "105" | "106";

interface NodeData {
  label: string;
  type: string;
  ip: string;
  desc: string;
  tags: string[];
  cpu: number;
  cpuOf: number;
  mem: number;
  disk: number;
  uptime: string;
}

const data: Record<NodeId, NodeData> = {
  host: {
    label: "serveur",
    type: "Hôte Proxmox VE 9.2.2",
    ip: "192.168.1.100",
    desc: "Le nœud physique qui héberge les six conteneurs ci-dessous. Chaque machine porte une adresse fixe dont le dernier octet reprend son identifiant Proxmox : une IP suffit à savoir de quel service il s'agit.",
    tags: [],
    cpu: 0,
    cpuOf: 6,
    mem: 19.4,
    disk: 1,
    uptime: "100j 01h",
  },
  "101": {
    label: "wireguard",
    type: "LXC 101",
    ip: "192.168.1.101",
    desc: "Tunnel VPN WireGuard : point d'entrée chiffré vers le réseau interne depuis l'extérieur, sans exposer les services d'administration sur internet.",
    tags: ["vpn", "udp/51820"],
    cpu: 0,
    cpuOf: 1,
    mem: 3.3,
    disk: 4.7,
    uptime: "1j 05h",
  },
  "102": {
    label: "reverse-proxy",
    type: "LXC 102",
    ip: "192.168.1.102",
    desc: "Traefik en frontal : unique porte d'entrée HTTP/HTTPS, routage par nom de domaine, certificats Let's Encrypt renouvelés automatiquement. CrowdSec filtre le trafic malveillant en amont des applications.",
    tags: ["traefik", "crowdsec", "docker"],
    cpu: 0.3,
    cpuOf: 2,
    mem: 21.8,
    disk: 34.5,
    uptime: "1j 04h",
  },
  "103": {
    label: "monitoring",
    type: "LXC 103",
    ip: "192.168.1.103",
    desc: "Stack de supervision Prometheus / Grafana : centralise les métriques CPU, mémoire et disque de l'ensemble des machines.",
    tags: ["prometheus", "grafana"],
    cpu: 3.8,
    cpuOf: 2,
    mem: 12,
    disk: 18.3,
    uptime: "70j 22h",
  },
  "104": {
    label: "archipelago",
    type: "LXC 104",
    ip: "192.168.1.104",
    desc: "Serveur de jeu Archipelago, exposé via le reverse proxy sur son propre sous-domaine.",
    tags: ["websocket"],
    cpu: 0.7,
    cpuOf: 1,
    mem: 38.1,
    disk: 8.2,
    uptime: "1j 04h",
  },
  "105": {
    label: "portfolio",
    type: "LXC 105",
    ip: "192.168.1.105",
    desc: "Ce site. Un runner GitHub Actions y tourne : chaque push sur main déclenche la vérification du build, puis un déploiement par release horodatée avec bascule atomique et retour arrière possible.",
    tags: ["nginx", "ci/cd", "astro"],
    cpu: 0,
    cpuOf: 1,
    mem: 7,
    disk: 14.7,
    uptime: "1j 03h",
  },
  "106": {
    label: "roissyshare",
    type: "LXC 106",
    ip: "192.168.1.106",
    desc: "La plateforme RoissyShare et sa base PostgreSQL/PostGIS, en conteneurs Docker, avec son propre pipeline de déploiement. Migrée depuis une machine virtuelle : à charge égale, un conteneur ne réserve pas sa mémoire.",
    tags: ["docker", "postgis", "ci/cd"],
    cpu: 0.1,
    cpuOf: 2,
    mem: 11.7,
    disk: 20.1,
    uptime: "0j 04h",
  },
};

const positions: { id: NodeId; left: number; host?: boolean }[] = [
  { id: "host", left: 50, host: true },
  { id: "101", left: 8 },
  { id: "102", left: 24.4 },
  { id: "103", left: 40.8 },
  { id: "104", left: 57.2 },
  { id: "105", left: 73.6 },
  { id: "106", left: 90 },
];

export default function NetworkDiagram() {
  const [selected, setSelected] = useState<NodeId>("host");
  const d = data[selected];
  const cpu = useCountUp(d.cpu);
  const mem = useCountUp(d.mem);
  const disk = useCountUp(d.disk);

  return (
    <>
      <div className="diagram">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none">
          {positions
            .filter((p) => !p.host)
            .map((p) => (
              <line
                key={p.id}
                x1={50}
                y1={18}
                x2={p.left}
                y2={78}
                className={selected === p.id ? "active" : ""}
              />
            ))}
        </svg>
        {positions.map((p) => (
          <button
            key={p.id}
            className={`node${p.host ? " host" : ""}`}
            style={{ left: `${p.left}%`, top: p.host ? "18%" : "78%" }}
            aria-pressed={selected === p.id}
            onClick={() => setSelected(p.id)}
          >
            <span className="led"></span>
            {data[p.id].label}
          </button>
        ))}
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>{d.label}</h2>
          <span className="type mono">
            {d.type} · {d.ip}
          </span>
        </div>
        <p className="desc">{d.desc}</p>
        {d.tags.length > 0 && (
          <div className="tags">
            {d.tags.map((t) => (
              <span key={t}>{t}</span>
            ))}
          </div>
        )}
        <div className="metrics">
          <div className="metric">
            <span className="m-label mono">CPU</span>
            <div className="m-value mono">
              {cpu}% <span className="of">/ {d.cpuOf} vCPU</span>
            </div>
            <div className="bar">
              <span style={{ ["--w" as any]: `${Math.min(d.cpu * 4, 100)}%` }}></span>
            </div>
          </div>
          <div className="metric">
            <span className="m-label mono">MÉMOIRE</span>
            <div className="m-value mono">{mem}%</div>
            <div className="bar">
              <span style={{ ["--w" as any]: `${d.mem}%` }}></span>
            </div>
          </div>
          <div className="metric">
            <span className="m-label mono">DISQUE</span>
            <div className="m-value mono">{disk}%</div>
            <div className="bar">
              <span style={{ ["--w" as any]: `${d.disk}%` }}></span>
            </div>
          </div>
          <div className="metric">
            <span className="m-label mono">UPTIME</span>
            <div className="m-value mono">{d.uptime}</div>
          </div>
        </div>
      </div>
    </>
  );
}
