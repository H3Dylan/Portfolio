import { useState } from "react";

type NodeId = "host" | "101" | "102" | "103" | "100";

interface NodeData {
  label: string;
  type: string;
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
    desc: "Le nœud physique qui héberge l'ensemble des services ci-dessous.",
    tags: [],
    cpu: 1.3,
    cpuOf: 6,
    mem: 26.1,
    disk: 0.3,
    uptime: "91j 17h",
  },
  "101": {
    label: "wireguard-vpn",
    type: "LXC",
    desc: "Tunnel VPN WireGuard : point d'entrée sécurisé pour accéder au homelab à distance sans exposer les services directement sur internet.",
    tags: [],
    cpu: 0.0,
    cpuOf: 1,
    mem: 4.0,
    disk: 4.7,
    uptime: "91j 11h",
  },
  "102": {
    label: "reverse-proxy",
    type: "LXC",
    desc: "Route le trafic entrant vers le bon service interne et gère la terminaison TLS.",
    tags: ["community-script", "docker", "proxy"],
    cpu: 0.5,
    cpuOf: 2,
    mem: 25.2,
    disk: 34.6,
    uptime: "90j 14h",
  },
  "103": {
    label: "monitoring",
    type: "LXC",
    desc: "Stack de supervision : centralise les métriques (CPU, mémoire, uptime) de tous les services du cluster.",
    tags: [],
    cpu: 0.5,
    cpuOf: 2,
    mem: 12.1,
    disk: 18.4,
    uptime: "62j 13h",
  },
  "100": {
    label: "Web-server",
    type: "VM (QEMU)",
    desc: "Sert actuellement à déployer RoissyShare (projet d'équipe M2), et accueillera sans doute ce portfolio une fois prêt.",
    tags: [],
    cpu: 0.3,
    cpuOf: 2,
    mem: 91.3,
    disk: 0.0,
    uptime: "91j 00h",
  },
};

const positions: { id: NodeId; left: number; host?: boolean }[] = [
  { id: "host", left: 50, host: true },
  { id: "101", left: 15 },
  { id: "102", left: 38 },
  { id: "103", left: 62 },
  { id: "100", left: 85 },
];

export default function NetworkDiagram() {
  const [selected, setSelected] = useState<NodeId>("host");
  const d = data[selected];

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
          <span className="type mono">{d.type}</span>
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
              {d.cpu}% <span className="of">/ {d.cpuOf} vCPU</span>
            </div>
            <div className="bar">
              <span style={{ ["--w" as any]: `${Math.min(d.cpu * 4, 100)}%` }}></span>
            </div>
          </div>
          <div className="metric">
            <span className="m-label mono">MÉMOIRE</span>
            <div className="m-value mono">{d.mem}%</div>
            <div className="bar">
              <span style={{ ["--w" as any]: `${d.mem}%` }}></span>
            </div>
          </div>
          <div className="metric">
            <span className="m-label mono">DISQUE</span>
            <div className="m-value mono">{d.disk}%</div>
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
