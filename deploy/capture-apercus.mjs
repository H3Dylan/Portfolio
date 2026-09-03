// Regenere les apercus des sites affiches sur les cartes projet.
//
//   node deploy/capture-apercus.mjs
//
// Se lance depuis un poste Windows disposant d'Edge ou de Chrome. Le pilotage
// passe par CDP plutot que par --screenshot : on peut ainsi laisser la page
// finir de s'afficher, ce dont les applications React ont besoin.
//
// Par defaut le portfolio est capture depuis le site en ligne. Pour figer une
// refonte pas encore deployee, lancer `npm run dev` et remplacer l'url par
// http://localhost:4321.

import { spawn } from "node:child_process";
import { writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RACINE = join(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = 9333;

const NAVIGATEURS = [
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
];

const CIBLES = [
  {
    // L'application redirige vers /login : le reste demande une authentification.
    url: "https://roissyshare.dylanbouillon.fr/login",
    fichier: "public/shots/roissyshare.png",
    largeur: 760,
    hauteur: 480,
  },
  {
    url: "https://dylanbouillon.fr",
    fichier: "public/shots/portfolio.png",
    largeur: 1280,
    hauteur: 800,
  },
];

const dors = (ms) => new Promise((r) => setTimeout(r, ms));

const navigateur = NAVIGATEURS.find((c) => existsSync(c));
if (!navigateur) {
  console.error("Aucun navigateur trouve parmi :\n  " + NAVIGATEURS.join("\n  "));
  process.exit(1);
}

async function capture({ url, fichier, largeur, hauteur }) {
  const profil = `${process.env.TEMP}/portfolio-capture-${Date.now()}`.split("\\").join("/");
  const proc = spawn(navigateur, [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profil}`,
    "about:blank",
  ], { stdio: "ignore" });

  let cibles;
  for (let i = 0; i < 40; i++) {
    await dors(300);
    try {
      cibles = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
    } catch {}
    if (cibles?.some((t) => t.type === "page")) break;
  }
  if (!cibles) throw new Error("le navigateur n'a pas ouvert son port de debogage");

  const ws = new WebSocket(cibles.find((t) => t.type === "page").webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));

  let id = 0;
  const attentes = new Map();
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && attentes.has(m.id)) {
      attentes.get(m.id)(m.result);
      attentes.delete(m.id);
    }
  };
  const envoie = (method, params = {}) =>
    new Promise((r) => {
      const n = ++id;
      attentes.set(n, r);
      ws.send(JSON.stringify({ id: n, method, params }));
    });

  await envoie("Page.enable");
  // La taille de fenetre passe par CDP : --window-size est ignore des qu'un
  // profil existant est reutilise.
  await envoie("Emulation.setDeviceMetricsOverride", {
    width: largeur, height: hauteur, deviceScaleFactor: 1, mobile: false,
  });
  await envoie("Page.navigate", { url });
  await dors(5000);

  const { data } = await envoie("Page.captureScreenshot", { format: "png" });
  const chemin = join(RACINE, fichier);
  writeFileSync(chemin, Buffer.from(data, "base64"));
  ws.close();
  proc.kill();
  console.log(`${fichier} : ${largeur}x${hauteur}, ${Buffer.from(data, "base64").length} octets`);
}

for (const cible of CIBLES) {
  await capture(cible);
}
