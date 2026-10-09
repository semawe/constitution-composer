// Serveur statique de vérification : sert `out/` avec les en-têtes de la cible
// réelle (dont la CSP), pour vérifier que l'export tourne sous la politique
// réelle. La politique suit le backend du build (marque `cc-backend` de
// out/index.html) : celle de l'instance pour un build « serveur », celle du
// mutualisé pour un build Supabase (scripts/lib/csp.mjs).
//
// Usage : node scripts/serve-out.mjs
// Avec API_ORIGIN=http://127.0.0.1:3100, le chemin /api/ est transmis à un
// service des comptes local, comme le fait nginx sur l'instance : le parcours
// de connexion se rejoue alors dans un vrai navigateur, sur la même origine.
import { createServer, request as requeteHttp } from 'node:http';
import { readFileSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cspPourMarque } from './lib/csp.mjs';
import { lireMarqueBackend } from './lib/deploiement.mjs';

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'out');
const PORT = Number(process.env.PORT || 4173);
// Outil de vérification locale : il n'écoute que la boucle locale. Sans adresse,
// Node écoute toutes les interfaces, et le serveur se retrouvait joignable du
// réseau (audit du 04/10/2026, F18). `HOST=0.0.0.0` reste possible, et se demande.
const HOST = process.env.HOST || '127.0.0.1';
const API = process.env.API_ORIGIN || '';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

/** La CSP qui convient au build de `out`, d'après la marque de sa page d'accueil. */
export function cspDuBuild(out) {
  try {
    return cspPourMarque(lireMarqueBackend(readFileSync(join(out, 'index.html'), 'utf8')));
  } catch {
    return cspPourMarque(null);
  }
}

/**
 * Le gestionnaire de requêtes pour un export donné. Toute erreur (décodage de
 * l'URL, lecture du fichier) se termine en réponse et non en arrêt du
 * processus : `GET /%` levait une `URIError` hors de toute interception, et le
 * serveur tombait (audit du 04/10/2026, F18).
 */
export function creerGestionnaire({ out = OUT, api = API } = {}) {
  const EN_TETES = {
    'Content-Security-Policy': cspDuBuild(out),
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Frame-Options': 'SAMEORIGIN',
  };

  async function resolveFile(pathname) {
    const clean = pathname.split('?')[0].replace(/\/+$/, '') || '/index';
    const candidates = [join(out, clean), join(out, `${clean}.html`), join(out, clean, 'index.html')];
    for (const c of candidates) {
      // Avec son séparateur : `out-autre/` commence aussi par `out`.
      if (c !== out && !c.startsWith(out + sep)) continue;
      try {
        const s = await stat(c);
        if (s.isFile()) return c;
      } catch {}
    }
    return null;
  }

  /** Transmet une requête /api/ au service local, comme `proxy_pass` de nginx. */
  function transmettre(req, res) {
    const amont = requeteHttp(
      new URL(req.url || '/', api),
      {
        method: req.method,
        headers: { ...req.headers, 'x-real-ip': req.socket.remoteAddress ?? '' },
      },
      (reponse) => {
        res.writeHead(reponse.statusCode ?? 502, reponse.headers);
        reponse.pipe(res);
      },
    );
    amont.on('error', () => {
      if (!res.headersSent) res.writeHead(502, EN_TETES);
      res.end('502 : service des comptes injoignable');
    });
    req.pipe(amont);
  }

  return async function servir(req, res) {
    if (api && (req.url === '/api' || req.url?.startsWith('/api/'))) {
      transmettre(req, res);
      return;
    }
    let chemin;
    try {
      chemin = decodeURIComponent(req.url || '/');
    } catch {
      res.writeHead(400, { ...EN_TETES, 'Content-Type': TYPES['.txt'] });
      res.end('400 : URL mal formée');
      return;
    }
    try {
      const file = await resolveFile(chemin);
      if (!file) {
        try {
          const corps = await readFile(join(out, '404.html'));
          res.writeHead(404, { ...EN_TETES, 'Content-Type': TYPES['.html'] });
          res.end(corps);
        } catch {
          res.writeHead(404, EN_TETES);
          res.end('404');
        }
        return;
      }
      const corps = await readFile(file);
      res.writeHead(200, {
        ...EN_TETES,
        'Content-Type': TYPES[extname(file)] || 'application/octet-stream',
      });
      res.end(corps);
    } catch {
      // Fichier disparu entre le `stat` et la lecture, droits, disque : une
      // réponse, pas un arrêt. Les en-têtes peuvent être déjà partis.
      if (!res.headersSent) res.writeHead(500, EN_TETES);
      res.end('500');
    }
  };
}

/** Démarre le serveur ; rendu pour qu'un test puisse l'arrêter. */
export function demarrer(port = PORT, hote = HOST, options = {}) {
  const servir = creerGestionnaire(options);
  const api = options.api ?? API;
  return createServer((req, res) => void servir(req, res)).listen(port, hote, () => {
    console.log(
      `out/ servi sur http://${hote}:${port} (CSP de la cible appliquée)` +
        (api ? `, /api/ transmis à ${api}` : ''),
    );
  });
}

// Lancé directement (`node scripts/serve-out.mjs`), il démarre ; importé par un
// test, il ne fait rien.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  demarrer();
