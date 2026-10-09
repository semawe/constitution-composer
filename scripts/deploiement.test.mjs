// Les gardes et la manœuvre du déploiement, éprouvées sans toucher à
// l'hébergement.
//
// Trois constats de l'audit adverse du 04/10/2026 :
//   F05 — la garde « ce build a un backend » se contentait d'une sous-chaîne
//         que le SDK Supabase contient de lui-même ;
//   F08 — la connexion SFTP acceptait n'importe quelle clé de serveur ;
//   F16 — une publication retirait les fragments dont les onglets déjà ouverts
//         avaient encore besoin.
// Et F18, pour le serveur local de vérification.
//
// Lot 4 de la sortie de Supabase (tâche ERP 3052) : les mêmes garanties pour le
// déploiement vers l'instance (scripts/deploy-instance.mjs) — marque
// « serveur », clé d'hôte épinglée par OpenSSH, archive scellée, fragments
// reportés par l'étape `site` de deploy/installer-preprod.sh —, et la
// politique de sécurité sans Supabase, recopiée à l'identique là où elle est
// servie.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { createHash } from 'node:crypto';
import ssh2 from 'ssh2';
import SftpClient from 'ssh2-sftp-client';
import {
  empreinteCleHote,
  jugerBackend,
  lireEmpreintesAttendues,
  lireMarqueBackend,
  planifierRetention,
  publierParSftp,
  verificateurCleHote,
} from './lib/deploiement.mjs';
import { demarrer } from './serve-out.mjs';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { CSP_SERVEUR, CSP_SUPABASE } from './lib/csp.mjs';
import {
  citer,
  construireArchiveSite,
  identifiantRelease,
  lireClesEpinglees,
  optionsSsh,
  planifierReport,
} from './lib/instance.mjs';

let bac;
beforeEach(() => {
  bac = mkdtempSync(join(tmpdir(), 'cc-deploiement-'));
});
afterEach(() => rmSync(bac, { recursive: true, force: true }));

function ecrire(chemin, contenu) {
  mkdirSync(dirname(chemin), { recursive: true });
  writeFileSync(chemin, contenu);
}

const page = (marque) =>
  `<!DOCTYPE html><html lang="fr"><head>${
    marque === null ? '' : `<meta name="cc-backend" content="${marque}"/>`
  }</head><body><script src="/_next/static/chunks/app.js"></script></body></html>`;

/** Un export statique minimal, dans `bac/<nom>`. */
function exportStatique(nom, { marque, bundle = '', fragments = {} }) {
  const out = join(bac, nom);
  for (const p of ['index.html', 'composer.html', 'en/composer.html'])
    ecrire(join(out, p), page(marque));
  ecrire(join(out, '.htaccess'), 'Options -Indexes\n');
  ecrire(join(out, '_next/static/chunks/app.js'), `/* app */ ${bundle}`);
  for (const [chemin, contenu] of Object.entries(fragments))
    ecrire(join(out, '_next/static', chemin), contenu);
  return out;
}

const HOTE = 'abcdefghijklmnopqrst.supabase.co';
// Ce que le SDK embarque de lui-même, et qui trompait l'ancienne garde.
const SDK = 'function h(u){return u.hostname.endsWith(".supabase.co")}';

describe('F05 — le build porte-t-il un backend ?', () => {
  it('lit la marque quel que soit l’ordre des attributs', () => {
    expect(lireMarqueBackend('<meta name="cc-backend" content="demo"/>')).toBe('demo');
    expect(lireMarqueBackend('<meta content="demo" name="cc-backend">')).toBe('demo');
    expect(lireMarqueBackend('<meta name="autre" content="demo">')).toBeNull();
  });

  it('refuse un build de démonstration, même si le SDK contient « .supabase.co »', () => {
    // La reproduction de l'audit, retournée : ce build passait toutes les gardes.
    const out = exportStatique('demo', { marque: 'demo', bundle: SDK });
    const verdict = jugerBackend(out);
    expect(verdict.ok).toBe(false);
    expect(verdict.message).toContain('démonstration');
  });

  it('accepte la démonstration quand elle est assumée, et l’affiche comme telle', () => {
    const out = exportStatique('demo', { marque: 'demo', bundle: SDK });
    const verdict = jugerBackend(out, { autoriserDemo: true });
    expect(verdict).toMatchObject({ ok: true, demo: true });
    expect(verdict.message).toContain('DÉMONSTRATION');
  });

  it('reconnaît un build configuré', () => {
    const out = exportStatique('prod', {
      marque: `supabase:${HOTE}`,
      bundle: `${SDK};const u="https://${HOTE}"`,
    });
    expect(jugerBackend(out)).toMatchObject({ ok: true, demo: false, hote: HOTE });
  });

  it('refuse un build d’avant la marque', () => {
    const out = exportStatique('ancien', { marque: null, bundle: `"https://${HOTE}"` });
    const verdict = jugerBackend(out);
    expect(verdict.ok).toBe(false);
    expect(verdict.message).toContain('npm run build');
  });

  it('refuse un out/ qui mélange deux builds', () => {
    const out = exportStatique('mixte', {
      marque: `supabase:${HOTE}`,
      bundle: `"https://${HOTE}"`,
    });
    ecrire(join(out, 'lite.html'), page('demo'));
    expect(jugerBackend(out).ok).toBe(false);
  });

  it('refuse quand l’HTML annonce un backend que le bundle ne porte pas', () => {
    const out = exportStatique('incoherent', { marque: `supabase:${HOTE}`, bundle: SDK });
    expect(jugerBackend(out).ok).toBe(false);
  });

  it('reconnaît un build « serveur » : l’HTML et le bundle parlent au service des comptes', () => {
    const out = exportStatique('serveur', {
      marque: 'serveur',
      bundle: 'fetch("/api/session",{credentials:"same-origin"})',
    });
    expect(jugerBackend(out, { familles: ['serveur'] })).toMatchObject({ ok: true, demo: false });
  });

  it('chaque cible refuse le backend de l’autre', () => {
    const serveur = exportStatique('serveur', { marque: 'serveur', bundle: '"/api/session"' });
    const supabase = exportStatique('supabase', {
      marque: `supabase:${HOTE}`,
      bundle: `"https://${HOTE}"`,
    });
    // Le mutualisé n'a pas de service des comptes ; l'instance n'a pas Supabase.
    expect(jugerBackend(serveur, { familles: ['supabase'] }).message).toContain('n’héberge pas');
    expect(jugerBackend(supabase, { familles: ['serveur'] }).message).toContain('NEXT_PUBLIC_BACKEND=serveur');
  });

  it('refuse un build « serveur » dont le bundle ne parle pas au service, ou embarque encore Supabase', () => {
    const muet = exportStatique('muet', { marque: 'serveur', bundle: SDK });
    expect(jugerBackend(muet, { familles: ['serveur'] }).ok).toBe(false);
    const mixte = exportStatique('mixte-serveur', {
      marque: 'serveur',
      bundle: `"/api/session";const u="https://${HOTE}"`,
    });
    const verdict = jugerBackend(mixte, { familles: ['serveur'] });
    expect(verdict.ok).toBe(false);
    expect(verdict.message).toContain(HOTE);
  });

  it('refuse un autre projet que celui attendu', () => {
    const out = exportStatique('autre', {
      marque: `supabase:${HOTE}`,
      bundle: `"https://${HOTE}"`,
    });
    expect(jugerBackend(out, { attendu: HOTE }).ok).toBe(true);
    expect(jugerBackend(out, { attendu: 'zzzzzzzzzzzzzzzzzzzz.supabase.co' }).ok).toBe(
      false,
    );
  });
});

describe('F08 — la clé du serveur SFTP', () => {
  const paire = ssh2.utils.generateKeyPairSync('ed25519');
  const clePublique = ssh2.utils.parseKey(paire.public).getPublicSSH();
  const bonne = empreinteCleHote(clePublique);

  it('calcule l’empreinte comme OpenSSH (`ssh-keygen -lf`)', () => {
    expect(bonne).toBe(
      'SHA256:' +
        createHash('sha256').update(clePublique).digest('base64').replace(/=+$/, ''),
    );
    expect(bonne).toMatch(/^SHA256:[A-Za-z0-9+/]{43}$/);
  });

  it('sans empreinte configurée, on ne se connecte pas', () => {
    expect(() => lireEmpreintesAttendues(undefined)).toThrow(/obligatoire/);
    expect(() => lireEmpreintesAttendues('  ')).toThrow(/obligatoire/);
  });

  it('refuse une empreinte mal formée, accepte une liste pour la rotation', () => {
    expect(() => lireEmpreintesAttendues('MD5:aa:bb')).toThrow(/mal formée/);
    expect(() => lireEmpreintesAttendues(`${bonne}=`)).toThrow(/mal formée/);
    const autre = `SHA256:${'A'.repeat(43)}`;
    expect(lireEmpreintesAttendues(` ${bonne} , ${autre} `)).toEqual([bonne, autre]);
  });

  /** Un serveur SSH local, qui note chaque tentative d'authentification. */
  async function serveur() {
    const tentatives = [];
    const srv = new ssh2.Server({ hostKeys: [paire.private] }, (client) => {
      client.on('authentication', (ctx) => {
        tentatives.push({ methode: ctx.method, motDePasse: ctx.password ?? null });
        ctx.reject();
      });
      client.on('error', () => {});
    });
    await new Promise((r) => srv.listen(0, '127.0.0.1', r));
    return { srv, port: srv.address().port, tentatives };
  }

  async function seConnecter(port, attendues) {
    const cle = verificateurCleHote(attendues);
    const sftp = new SftpClient();
    sftp.on('error', () => {});
    let erreur = null;
    try {
      await sftp.connect({
        host: '127.0.0.1',
        port,
        username: 'publication',
        password: 'mot-de-passe-de-publication',
        hostVerifier: cle.verifier,
        readyTimeout: 4000,
        retries: 0,
      });
    } catch (err) {
      erreur = err;
    }
    await sftp.end().catch(() => {});
    return { erreur, vue: cle.etat.vue };
  }

  it('clé inattendue : refus avant toute authentification, le mot de passe ne part pas', async () => {
    const { srv, port, tentatives } = await serveur();
    try {
      const { erreur, vue } = await seConnecter(port, [`SHA256:${'A'.repeat(43)}`]);
      expect(erreur).not.toBeNull();
      // L'empreinte présentée est connue, pour pouvoir la dire dans l'erreur.
      expect(vue).toBe(bonne);
      // Le serveur n'a vu passer aucun identifiant : c'est tout l'enjeu.
      expect(tentatives).toEqual([]);
    } finally {
      await new Promise((r) => srv.close(r));
    }
  });

  it('bonne clé : la connexion va jusqu’à l’authentification', async () => {
    const { srv, port, tentatives } = await serveur();
    try {
      const { erreur } = await seConnecter(port, [bonne]);
      // Ce serveur d'essai refuse tout le monde : l'erreur est attendue, mais
      // elle vient de l'authentification — donc après la clé.
      expect(erreur).not.toBeNull();
      expect(tentatives.some((t) => t.methode === 'password')).toBe(true);
    } finally {
      await new Promise((r) => srv.close(r));
    }
  });
});

describe('F16 — les fragments de la génération précédente', () => {
  const jour = (n) => new Date(Date.UTC(2026, 9, n, 12));

  it('reporte ce qui n’est plus courant, et note depuis quand', () => {
    const plan = planifierRetention({
      anciens: ['chunks/pdf-A.js', 'chunks/commun.js'],
      nouveaux: ['chunks/pdf-B.js', 'chunks/commun.js'],
      maintenant: jour(4),
    });
    expect(plan.aReporter).toEqual(['chunks/pdf-A.js']);
    expect(plan.manifeste).toEqual({ 'chunks/pdf-A.js': jour(4).toISOString() });
  });

  it('garde la date du premier report : une génération longue ne prolonge rien', () => {
    const plan = planifierRetention({
      anciens: ['chunks/pdf-A.js'],
      nouveaux: [],
      manifeste: { 'chunks/pdf-A.js': jour(1).toISOString() },
      maintenant: jour(20),
    });
    expect(plan.manifeste['chunks/pdf-A.js']).toBe(jour(1).toISOString());
  });

  it('laisse partir ce qui a dépassé la durée', () => {
    const plan = planifierRetention({
      anciens: ['chunks/vieux.js', 'chunks/recent.js'],
      nouveaux: [],
      manifeste: {
        'chunks/vieux.js': new Date(Date.UTC(2026, 7, 1)).toISOString(),
        'chunks/recent.js': jour(1).toISOString(),
      },
      maintenant: jour(4),
      jours: 30,
    });
    expect(plan.aReporter).toEqual(['chunks/recent.js']);
    expect(plan.manifeste).not.toHaveProperty('chunks/vieux.js');
  });

  it('un fragment republié à l’identique sort du registre', () => {
    const plan = planifierRetention({
      anciens: ['chunks/revenu.js'],
      nouveaux: ['chunks/revenu.js'],
      manifeste: { 'chunks/revenu.js': jour(1).toISOString() },
      maintenant: jour(4),
    });
    expect(plan).toEqual({ aReporter: [], manifeste: {} });
  });

  /** Un client qui parle comme `ssh2-sftp-client`, sur un dossier local. */
  function hebergement() {
    const racine = join(bac, 'hebergement');
    mkdirSync(racine, { recursive: true });
    const local = (p) => join(racine, p);
    const type = (p) =>
      !existsSync(local(p)) ? false : statSync(local(p)).isDirectory() ? 'd' : '-';
    return {
      racine,
      sftp: {
        exists: async (p) => type(p),
        list: async (p) =>
          readdirSync(local(p)).map((name) => ({ name, type: type(`${p}/${name}`) })),
        delete: async (p) => rmSync(local(p)),
        rmdir: async (p) => rmSync(local(p), { recursive: true }),
        mkdir: async (p) => void mkdirSync(local(p), { recursive: true }),
        uploadDir: async (src, dst) => cpSync(src, local(dst), { recursive: true }),
        rename: async (a, b) => renameSync(local(a), local(b)),
        get: async (p) => readFileSync(local(p)),
        put: async (contenu, p) => writeFileSync(local(p), contenu),
      },
    };
  }

  const muet = { log() {}, warn() {} };
  const CIBLE = '/site';

  it('un onglet de la génération A trouve encore son fragment après la publication de B', async () => {
    const { racine, sftp } = hebergement();
    const a = exportStatique('A', {
      marque: 'demo',
      fragments: { 'chunks/pdf-A.js': 'moteur PDF, génération A' },
    });
    const b = exportStatique('B', {
      marque: 'demo',
      fragments: { 'chunks/pdf-B.js': 'moteur PDF, génération B' },
    });

    await publierParSftp({ sftp, out: a, cible: CIBLE, maintenant: jour(1), journal: muet });
    // L'onglet est ouvert sur A, sans avoir encore demandé le PDF. Puis B part.
    const bilan = await publierParSftp({
      sftp,
      out: b,
      cible: CIBLE,
      maintenant: jour(4),
      journal: muet,
    });

    const servi = (p) => join(racine, CIBLE, '_next/static', p);
    // Le fragment que l'onglet A va demander est toujours servi…
    expect(readFileSync(servi('chunks/pdf-A.js'), 'utf8')).toBe(
      'moteur PDF, génération A',
    );
    // …à côté de celui de B, qui est la génération courante.
    expect(existsSync(servi('chunks/pdf-B.js'))).toBe(true);
    expect(bilan.reportes).toBe(1);
    // Le registre vit hors du site servi, et la génération remplacée est partie.
    expect(
      JSON.parse(readFileSync(join(racine, `${CIBLE}.fragments.json`), 'utf8')),
    ).toEqual({ 'chunks/pdf-A.js': jour(4).toISOString() });
    expect(existsSync(join(racine, `${CIBLE}.precedent`))).toBe(false);
    expect(existsSync(join(racine, `${CIBLE}.transit`))).toBe(false);
  });

  it('le report est borné : passé la durée, le fragment part avec sa génération', async () => {
    const { racine, sftp } = hebergement();
    const generation = (nom) =>
      exportStatique(nom, {
        marque: 'demo',
        fragments: { [`chunks/pdf-${nom}.js`]: nom },
      });
    const publier = (nom, quand) =>
      publierParSftp({
        sftp,
        out: generation(nom),
        cible: CIBLE,
        maintenant: quand,
        retentionJours: 30,
        journal: muet,
      });

    await publier('A', jour(1));
    await publier('B', jour(4));
    // Quarante jours plus tard : A a cessé d'être courante depuis plus de trente.
    await publier('C', new Date(Date.UTC(2026, 10, 13)));

    const servi = (p) => existsSync(join(racine, CIBLE, '_next/static', p));
    expect(servi('chunks/pdf-A.js')).toBe(false);
    expect(servi('chunks/pdf-B.js')).toBe(true);
    expect(servi('chunks/pdf-C.js')).toBe(true);
  });

  it('un envoi incomplet ne touche pas à la version en ligne', async () => {
    const { racine, sftp } = hebergement();
    const a = exportStatique('A', { marque: 'demo' });
    await publierParSftp({ sftp, out: a, cible: CIBLE, journal: muet });
    const b = exportStatique('B', { marque: 'demo', bundle: 'B' });
    // L'envoi « oublie » le fragment que les pages réclament.
    const tronque = {
      ...sftp,
      uploadDir: async (src, dst) => {
        await sftp.uploadDir(src, dst);
        rmSync(join(racine, dst, '_next/static/chunks/app.js'));
      },
    };

    await expect(
      publierParSftp({ sftp: tronque, out: b, cible: CIBLE, journal: muet }),
    ).rejects.toThrow(/Envoi incomplet/);

    expect(
      readFileSync(join(racine, CIBLE, '_next/static/chunks/app.js'), 'utf8'),
    ).toBe('/* app */ ');
  });
});

describe('F18 — le serveur local de vérification', () => {
  async function avecServeur(essai) {
    const srv = demarrer(0, '127.0.0.1');
    await new Promise((r) => srv.once('listening', r));
    try {
      await essai(`http://127.0.0.1:${srv.address().port}`, srv);
    } finally {
      await new Promise((r) => srv.close(r));
    }
  }

  it('une URL mal formée reçoit un 400, et le serveur continue de servir', async () => {
    await avecServeur(async (base) => {
      for (const chemin of ['/%', '/%ZZ', '/a%E0%A4%A']) {
        const reponse = await fetch(base + chemin);
        expect(reponse.status, chemin).toBe(400);
      }
      // Toujours debout : avant, le premier `/%` arrêtait le processus.
      const suivante = await fetch(base + '/');
      expect([200, 404]).toContain(suivante.status);
      expect(suivante.headers.get('content-security-policy')).toContain("default-src 'self'");
    });
  });

  it('n’écoute que la boucle locale', async () => {
    await avecServeur(async (_base, srv) => {
      expect(srv.address().address).toBe('127.0.0.1');
    });
  });

  it('ne sert rien hors de out/', async () => {
    await avecServeur(async (base) => {
      const reponse = await fetch(base + '/..%2Fpackage.json');
      expect(reponse.status).toBe(404);
    });
  });
});

const RACINE_DEPOT = join(dirname(new URL(import.meta.url).pathname), '..');
const lireDepot = (chemin) => readFileSync(join(RACINE_DEPOT, chemin), 'utf8');
// Le dossier d'exploitation (deploy/ : vhosts, règles du pare-feu applicatif de
// l'instance partagée, installeur) n'est pas publié dans le miroir public
// (scripts/publier-miroir.mjs). Là où il manque, ses tests sont sautés : ils
// éprouvent l'exploitation de Sémawé, pas le code publié.
const AVEC_EXPLOITATION = existsSync(join(RACINE_DEPOT, 'deploy'));
const VHOSTS = [
  'deploy/nginx/constitution-composer.com.conf',
  'deploy/nginx/preprod.constitution-composer.com.conf',
];

describe('la politique de sécurité du contenu, par backend', () => {
  it('build « serveur » : seuls le site et Umami restent joignables, plus aucun hôte Supabase', () => {
    expect(CSP_SERVEUR).not.toMatch(/supabase/);
    expect(CSP_SERVEUR).toContain("connect-src 'self' https://cloud.umami.is https://gateway.umami.is;");
    // Le reste est la politique actuelle, à l'identique.
    expect(CSP_SERVEUR).toBe(
      CSP_SUPABASE.replace(
        ' https://zzebhtyvbzfnfrjhqiia.supabase.co wss://zzebhtyvbzfnfrjhqiia.supabase.co',
        '',
      ),
    );
  });

  it.skipIf(!AVEC_EXPLOITATION)('les recopies n’ont pas divergé : .htaccess du mutualisé, vhosts de l’instance', () => {
    expect(lireDepot('public/.htaccess')).toContain(
      `Header always set Content-Security-Policy "${CSP_SUPABASE}"`,
    );
    for (const vhost of VHOSTS)
      expect(lireDepot(vhost), vhost).toContain(
        `add_header Content-Security-Policy "${CSP_SERVEUR}" always;`,
      );
  });

  it('le serveur local applique la politique du build qu’il sert', async () => {
    for (const [nom, marque, attendue] of [
      ['csp-serveur', 'serveur', CSP_SERVEUR],
      ['csp-supabase', `supabase:${HOTE}`, CSP_SUPABASE],
    ]) {
      const out = exportStatique(nom, { marque });
      const srv = demarrer(0, '127.0.0.1', { out, api: '' });
      await new Promise((r) => srv.once('listening', r));
      try {
        const r = await fetch(`http://127.0.0.1:${srv.address().port}/composer`);
        expect(r.status).toBe(200);
        expect(r.headers.get('content-security-policy')).toBe(attendue);
      } finally {
        await new Promise((r) => srv.close(r));
      }
    }
  });

  it('le serveur local transmet /api/ au service, comme nginx', async () => {
    const amont = (await import('node:http')).createServer((req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ chemin: req.url, methode: req.method }));
    });
    await new Promise((r) => amont.listen(0, '127.0.0.1', r));
    const out = exportStatique('proxy', { marque: 'serveur' });
    const srv = demarrer(0, '127.0.0.1', { out, api: `http://127.0.0.1:${amont.address().port}` });
    await new Promise((r) => srv.once('listening', r));
    try {
      const r = await fetch(`http://127.0.0.1:${srv.address().port}/api/session?x=1`);
      expect(await r.json()).toEqual({ chemin: '/api/session?x=1', methode: 'GET' });
    } finally {
      await new Promise((r) => srv.close(r));
      await new Promise((r) => amont.close(r));
    }
  });
});

describe.skipIf(!AVEC_EXPLOITATION)('les vhosts nginx de l’instance', () => {
  const prod = AVEC_EXPLOITATION ? lireDepot('deploy/nginx/constitution-composer.com.conf') : '';
  const preprod = AVEC_EXPLOITATION
    ? lireDepot('deploy/nginx/preprod.constitution-composer.com.conf')
    : '';

  it('production : www et le domaine en .fr vers l’apex, HTTPS, HSTS d’un an', () => {
    expect(prod).toMatch(
      /server_name www\.constitution-composer\.com constitution-composer\.fr www\.constitution-composer\.fr;\s+access_log[^\n]+\n(?:.*\n){5}\s+return 301 https:\/\/constitution-composer\.com\$request_uri;/,
    );
    expect(prod).toContain('add_header Strict-Transport-Security "max-age=31536000" always;');
    expect(prod).toMatch(/listen 80;[\s\S]+?return 301 https:\/\/constitution-composer\.com\$request_uri;/);
  });

  it('les deux : adresses sans extension ni barre finale, page 404, cache long des fichiers hachés', () => {
    for (const [nom, vhost] of [['production', prod], ['préproduction', preprod]]) {
      expect(vhost, nom).toContain('try_files $uri $uri.html $uri/ =404;');
      expect(vhost, nom).toContain('error_page 404 /404.html;');
      expect(vhost, nom).toMatch(/if \(\$request_uri ~ "\^\/\+index\\\.html/);
      expect(vhost, nom).toMatch(/if \(\$request_uri ~ "\^\/\+\(\.\+\?\)\\\.html/);
      expect(vhost, nom).toMatch(/if \(\$request_uri ~ "\^\/\+\(\.\+\?\)\/\+/);
      expect(vhost, nom).toMatch(/~\^\/_next\/static\/\s+"public, max-age=31536000, immutable";/);
      expect(vhost, nom).toContain('X-Frame-Options "SAMEORIGIN"');
    }
  });

  it('les deux : les ajustements du pare-feu validés en préproduction', () => {
    for (const [nom, vhost, hote] of [
      ['production', prod, 'constitution-composer'],
      ['préproduction', preprod, 'preprod[.]constitution-composer'],
    ]) {
      // Retour de Google : seule ARGS:scope sort de 930120, et seulement avec iss=Google.
      expect(vhost, nom).toContain(
        'SecRule ARGS:iss "@streq https://accounts.google.com" "t:none,ctl:ruleRemoveTargetById=930120;ARGS:scope"',
      );
      // Corps de 2 Mio sous /api/, borné à 16 Kio sur la connexion.
      expect(vhost, nom).toContain('SecRequestBodyNoFilesLimit 2097152');
      expect(vhost, nom).toMatch(/location \^~ \/api\/ \{[\s\S]+?client_max_body_size 2m;/);
      expect(vhost, nom).toMatch(/location \^~ \/api\/connexion\/ \{[\s\S]+?client_max_body_size 16k;/);
      // Le seul champ logo, sur un POST de version (création ou figement), de cet hôte.
      expect(vhost, nom).toContain(
        '"@rx ^/api/versions(?:/[0-9a-fA-F-]{36}/remplacer)?$" "t:none,ctl:ruleRemoveTargetByTag=OWASP_CRS;ARGS:json.payload.logo"',
      );
      expect(vhost, nom).toContain(`"@rx (?i)^${hote}[.]com(?::443)?$"`);
    }
    // Identifiants de règle propres à chaque hôte.
    const ids = (v) => [...v.matchAll(/id:(\d+)/g)].map((m) => m[1]);
    expect(ids(preprod)).toEqual(['1000150', '1000151']);
    expect(ids(prod)).toEqual(['1000152', '1000153']);
  });

  it('les deux : le service sous /api/, et aucune autre destination', () => {
    for (const vhost of [prod, preprod]) {
      const cibles = [...vhost.matchAll(/proxy_pass (\S+);/g)].map((m) => m[1]);
      expect(new Set(cibles)).toEqual(new Set(['http://127.0.0.1:3007']));
    }
  });

  it('le regex du logo couvre la création et le figement, rien d’autre', () => {
    const re = /^\/api\/versions(?:\/[0-9a-fA-F-]{36}\/remplacer)?$/;
    expect(re.test('/api/versions')).toBe(true);
    expect(re.test('/api/versions/0b1c2d3e-4f50-6172-8394-a5b6c7d8e9f0/remplacer')).toBe(true);
    expect(re.test('/api/versions/0b1c2d3e-4f50-6172-8394-a5b6c7d8e9f0/renommer')).toBe(false);
    expect(re.test('/api/declaration')).toBe(false);
    expect(re.test('/api/versions?x=1')).toBe(false);
  });
});

describe('F08 — la clé de l’instance, épinglée pour OpenSSH', () => {
  const paire = ssh2.utils.generateKeyPairSync('ed25519');
  const autre = ssh2.utils.generateKeyPairSync('ed25519');
  const ligne = (p) => {
    const cle = ssh2.utils.parseKey(p.public);
    return `semawe-prod-gra11 ${cle.type} ${cle.getPublicSSH().toString('base64')}`;
  };

  it.skipIf(!AVEC_EXPLOITATION)('le fichier du dépôt épingle les trois clés de semawe-prod-gra11', () => {
    const cles = lireClesEpinglees(lireDepot('deploy/ssh/known_hosts'), 'semawe-prod-gra11');
    expect(cles.map((c) => c.type).sort()).toEqual(['ecdsa-sha2-nistp256', 'ssh-ed25519', 'ssh-rsa']);
  });

  it('sans clé épinglée pour l’alias, pas de connexion', () => {
    expect(() => lireClesEpinglees('# rien\n', 'semawe-prod-gra11')).toThrow(/aucune clé/);
    expect(() => lireClesEpinglees(ligne(paire), 'autre-hote')).toThrow(/aucune clé/);
  });

  it('les options ferment toute acceptation d’une clé inconnue', () => {
    const o = optionsSsh({ knownHosts: '/x/known_hosts', alias: 'semawe-prod-gra11' }).join(' ');
    for (const attendu of [
      'StrictHostKeyChecking=yes',
      'UserKnownHostsFile=/x/known_hosts',
      'GlobalKnownHostsFile=/dev/null',
      'HostKeyAlias=semawe-prod-gra11',
      'BatchMode=yes',
    ])
      expect(o).toContain(attendu);
  });

  /** Un serveur SSH local, qui note chaque tentative d'authentification. */
  async function serveurSsh() {
    const tentatives = [];
    const srv = new ssh2.Server({ hostKeys: [paire.private] }, (client) => {
      client.on('authentication', (ctx) => {
        tentatives.push(ctx.method);
        ctx.reject();
      });
      client.on('error', () => {});
    });
    await new Promise((r) => srv.listen(0, '127.0.0.1', r));
    return { srv, port: srv.address().port, tentatives };
  }

  /** Le vrai client OpenSSH, lancé sans bloquer : le serveur d'essai vit dans ce processus. */
  function connecter(port, epinglee) {
    const fichier = join(bac, 'known_hosts');
    writeFileSync(fichier, `${epinglee}\n`);
    return new Promise((resolve) => {
      const enfant = spawn(
        'ssh',
        [
          ...optionsSsh({ knownHosts: fichier, alias: 'semawe-prod-gra11', port }),
          '-F', '/dev/null',
          '-o', 'IdentitiesOnly=yes',
          '-o', 'IdentityFile=/dev/null',
          '-o', 'PreferredAuthentications=none,password',
          '-l', 'publication',
          '127.0.0.1',
          'true',
        ],
        { stdio: ['ignore', 'ignore', 'pipe'] },
      );
      let stderr = '';
      enfant.stderr.on('data', (d) => (stderr += d));
      const minuterie = setTimeout(() => enfant.kill(), 15000);
      enfant.on('close', (status) => {
        clearTimeout(minuterie);
        resolve({ status, stderr });
      });
    });
  }

  it('clé inattendue : OpenSSH refuse avant toute authentification', async () => {
    const { srv, port, tentatives } = await serveurSsh();
    try {
      const r = await connecter(port, ligne(autre));
      expect(r.status).not.toBe(0);
      expect(r.stderr).toMatch(/HOST IDENTIFICATION HAS CHANGED|Host key verification failed/);
      expect(tentatives).toEqual([]);
    } finally {
      await new Promise((r) => srv.close(r));
    }
  });

  it('bonne clé : la connexion va jusqu’à l’authentification', async () => {
    const { srv, port, tentatives } = await serveurSsh();
    try {
      const r = await connecter(port, ligne(paire));
      expect(r.status).not.toBe(0);
      expect(tentatives.length).toBeGreaterThan(0);
    } finally {
      await new Promise((r) => srv.close(r));
    }
  });

  it('les mots partent au shell distant intacts', () => {
    const mot = `a b'c"$d;rm -rf /`;
    expect(execFileSync('sh', ['-c', `printf %s ${citer(mot)}`]).toString()).toBe(mot);
  });
});

describe('F16 et release scellée — l’archive du site pour l’instance', () => {
  const jour = (n) => new Date(Date.UTC(2026, 9, n, 12));
  const COMMIT = 'a'.repeat(40);

  it('l’identifiant d’une release : commit et horodatage UTC', () => {
    expect(identifiantRelease(COMMIT, new Date(Date.UTC(2026, 9, 5, 9, 7, 3, 120)))).toBe(
      `${COMMIT}-20261005T090703Z`,
    );
    expect(() => identifiantRelease('abc')).toThrow();
  });

  it('le plan reporte les fragments de la génération en ligne qui ne sont plus courants', () => {
    const out = exportStatique('B', { marque: 'serveur', fragments: { 'chunks/pdf-B.js': 'B' } });
    const plan = planifierReport({
      anciens: ['chunks/pdf-A.js', 'chunks/app.js', '../../etc/passwd', 'chunks/vieux.js'],
      registre: JSON.stringify({ 'chunks/vieux.js': new Date(Date.UTC(2026, 7, 1)).toISOString() }),
      out,
      maintenant: jour(5),
    });
    // app.js est republié, vieux.js a fait son temps, le chemin remontant est ignoré.
    expect(plan.reporter).toEqual(['chunks/pdf-A.js']);
    expect(plan.registre).toEqual({ 'chunks/pdf-A.js': jour(5).toISOString() });
    // Registre illisible : on repart pour une durée entière, sans lever.
    expect(planifierReport({ anciens: ['chunks/x.js'], registre: '{pas du json', out, maintenant: jour(5) }).reporter).toEqual([
      'chunks/x.js',
    ]);
  });

  it('l’archive porte le site, le plan, l’identifiant et un manifeste qui couvre chaque fichier', () => {
    const out = exportStatique('C', { marque: 'serveur', fragments: { 'chunks/pdf-C.js': 'C' } });
    ecrire(join(out, '404.html'), page('serveur'));
    const releaseId = identifiantRelease(COMMIT, jour(5));
    const { archive, empreinte } = construireArchiveSite({
      out,
      releaseId,
      reporter: ['chunks/pdf-A.js'],
      registre: { 'chunks/pdf-A.js': jour(5).toISOString() },
      sortie: join(bac, 'archives'),
    });
    expect(empreinte).toBe(createHash('sha256').update(readFileSync(archive)).digest('hex'));
    const ici = join(bac, 'deballe');
    mkdirSync(ici);
    execFileSync('tar', ['-xzf', archive, '-C', ici]);
    expect(readFileSync(join(ici, 'RELEASE_ID'), 'utf8').trim()).toBe(releaseId);
    expect(readFileSync(join(ici, 'REPORTER'), 'utf8')).toBe('chunks/pdf-A.js\n');
    expect(existsSync(join(ici, 'site', 'index.html'))).toBe(true);
    // Le fichier Apache du mutualisé ne part pas sur l'instance.
    expect(existsSync(join(ici, 'site', '.htaccess'))).toBe(false);
    const manifeste = readFileSync(join(ici, 'MANIFESTE.sha256'), 'utf8').trim().split('\n');
    for (const l of manifeste) {
      const [somme, chemin] = l.split('  ');
      expect(createHash('sha256').update(readFileSync(join(ici, chemin))).digest('hex'), chemin).toBe(somme);
    }
    expect(manifeste.map((l) => l.split('  ')[1])).toEqual(
      expect.arrayContaining(['./site/index.html', './RELEASE_ID', './REPORTER', './FRAGMENTS.json']),
    );
  });
});

// L'étape `site` de deploy/installer-preprod.sh, jouée pour de bon dans un
// conteneur Debian (outils GNU, root) : rien d'autre ne prouve la bascule et le
// report sur l'instance sans y toucher. Sautée si Docker manque.
const dockerDisponible = spawnSync('docker', ['info'], { stdio: 'ignore' }).status === 0;

describe.skipIf(!dockerDisponible || !AVEC_EXPLOITATION)('l’étape « site » de l’installeur, dans un conteneur Debian', () => {
  const COMMIT = 'b'.repeat(40);
  const jour = (n) => new Date(Date.UTC(2026, 9, n, 12));

  function publier(depot, nom, quand, { reporter = [], registre = {}, alterer = false } = {}) {
    const out = exportStatique(nom, {
      marque: 'serveur',
      fragments: { [`chunks/pdf-${nom}.js`]: `moteur ${nom}` },
    });
    ecrire(join(out, '404.html'), page('serveur'));
    const { archive, empreinte } = construireArchiveSite({
      out,
      releaseId: identifiantRelease(COMMIT, quand),
      reporter,
      registre,
      sortie: depot,
    });
    if (alterer) {
      // Une archive altérée après coup : l'empreinte annoncée ne correspond plus.
      writeFileSync(archive, Buffer.concat([readFileSync(archive), Buffer.from('x')]));
    }
    return { fichier: `/depot/${archive.slice(depot.length + 1)}`, empreinte };
  }

  it('scelle, bascule le lien, reporte les fragments, garde trois générations, refuse une archive altérée', () => {
    const depot = join(bac, 'depot');
    mkdirSync(depot, { recursive: true });
    const a = publier(depot, 'A', jour(1));
    const b = publier(depot, 'B', jour(2), {
      reporter: ['chunks/pdf-A.js', 'chunks/absent.js'],
      registre: { 'chunks/pdf-A.js': jour(2).toISOString() },
    });
    const c = publier(depot, 'C', jour(3));
    const d = publier(depot, 'D', jour(4));
    const altere = publier(depot, 'E', jour(5), { alterer: true });
    cpSync(join(RACINE_DEPOT, 'deploy'), join(depot, 'deploy'), { recursive: true });

    const script = [
      'set -eu',
      // Le conteneur n'a pas procps : `free` est doublé pour la garde de capacité.
      "printf '#!/bin/sh\\necho \"Mem: 4000 1000 1000 0 0 2000\"\\n' > /usr/local/bin/free",
      'chmod +x /usr/local/bin/free',
      'I=/depot/deploy/installer-preprod.sh',
      'bash $I arborescence',
      'mkdir -p /srv/composer/site && echo attente > /srv/composer/site/index.html',
      `bash $I site ${a.fichier} ${a.empreinte}`,
      'echo "LIEN_A=$(readlink /srv/composer/site)"',
      `bash $I site ${b.fichier} ${b.empreinte}`,
      'echo "LIEN_B=$(readlink /srv/composer/site)"',
      'echo "REPORTE=$(cat /srv/composer/site/_next/static/chunks/pdf-A.js)"',
      'echo "PROPRIO=$(stat -c %U:%a /srv/composer/site/index.html)"',
      'echo "REGISTRE=$(tr -d " \\n" < /srv/composer/site-fragments.json)"',
      `bash $I site ${c.fichier} ${c.empreinte}`,
      `bash $I site ${d.fichier} ${d.empreinte}`,
      'echo "GENERATIONS=$(ls /srv/composer/sites | wc -l)"',
      `if bash $I site ${altere.fichier} ${altere.empreinte} 2>/dev/null; then echo ALTEREE=acceptee; else echo ALTEREE=refusee; fi`,
      'echo "LIEN_FINAL=$(readlink /srv/composer/site)"',
    ].join('\n');
    writeFileSync(join(depot, 'epreuve.sh'), `${script}\n`);
    // Le dépôt entre par l'entrée standard, en tar : aucun partage de dossier
    // avec la machine virtuelle de Docker n'est requis.
    const r = spawnSync(
      'docker',
      ['run', '--rm', '-i', 'debian:12', 'bash', '-c', 'mkdir /depot && tar -xf - -C /depot && bash /depot/epreuve.sh'],
      {
        input: execFileSync('tar', ['-C', depot, '-cf', '-', '.'], { env: { ...process.env, COPYFILE_DISABLE: '1' } }),
        encoding: 'utf8',
        timeout: 180000,
        maxBuffer: 16 * 1024 * 1024,
      },
    );
    expect(r.status, r.stderr).toBe(0);
    const vu = Object.fromEntries(
      r.stdout
        .split('\n')
        .filter((l) => /^[A-Z_]+=/.test(l))
        .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
    );
    const id = (n) => identifiantRelease(COMMIT, jour(n));
    expect(vu.LIEN_A).toBe(`sites/${id(1)}/site`);
    expect(vu.LIEN_B).toBe(`sites/${id(2)}/site`);
    // Le fragment de A, que des onglets ouverts sur A peuvent encore demander, est servi par B.
    expect(vu.REPORTE).toBe('moteur A');
    expect(vu.PROPRIO).toBe('root:644');
    expect(vu.REGISTRE).toBe(`{"chunks/pdf-A.js":"${jour(2).toISOString()}"}`);
    expect(Number(vu.GENERATIONS)).toBe(3);
    expect(vu.ALTEREE).toBe('refusee');
    expect(vu.LIEN_FINAL).toBe(`sites/${id(4)}/site`);
  }, 240000);
});
