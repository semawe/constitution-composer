// Serveur statique de vérification : sert `out/` en appliquant les mêmes
// en-têtes que le .htaccess de production (dont la CSP), pour vérifier que
// l'export réel tourne sous la politique réelle. Usage : node scripts/serve-out.mjs
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'out');
const PORT = Number(process.env.PORT || 4173);

// Recopie de la directive du .htaccess (garder les deux en phase).
const CSP =
  "default-src 'self'; script-src 'self' 'unsafe-inline' https://cloud.umami.is; " +
  "connect-src 'self' https://zzebhtyvbzfnfrjhqiia.supabase.co wss://zzebhtyvbzfnfrjhqiia.supabase.co " +
  "https://cloud.umami.is https://gateway.umami.is; img-src 'self' data: blob:; " +
  "font-src 'self'; style-src 'self' 'unsafe-inline'; worker-src 'self' blob:; " +
  "object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'";

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

async function resolveFile(pathname) {
  const clean = pathname.split('?')[0].replace(/\/+$/, '') || '/index';
  const candidates = [
    join(OUT, clean),
    join(OUT, `${clean}.html`),
    join(OUT, clean, 'index.html'),
  ];
  for (const c of candidates) {
    if (!c.startsWith(OUT)) continue;
    try {
      const s = await stat(c);
      if (s.isFile()) return c;
    } catch {}
  }
  return null;
}

createServer(async (req, res) => {
  const file = await resolveFile(decodeURIComponent(req.url || '/'));
  const headers = {
    'Content-Security-Policy': CSP,
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Frame-Options': 'SAMEORIGIN',
  };
  if (!file) {
    const notFound = join(OUT, '404.html');
    try {
      res.writeHead(404, { ...headers, 'Content-Type': TYPES['.html'] });
      res.end(await readFile(notFound));
    } catch {
      res.writeHead(404, headers);
      res.end('404');
    }
    return;
  }
  res.writeHead(200, {
    ...headers,
    'Content-Type': TYPES[extname(file)] || 'application/octet-stream',
  });
  res.end(await readFile(file));
}).listen(PORT, () => {
  console.log(`out/ servi sur http://localhost:${PORT} (CSP de prod appliquée)`);
});
