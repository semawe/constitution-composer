// Déploiement FTP du build statique (out/) vers constitution-composer.com,
// hébergé sur le compte OVH Heterostasia (hébergement mutualisé gratuit 100 Mo).
// Même modèle que heterostasia.com. Le code reste dans ce repo (semawe/) ; le
// compte OVH n'est qu'une cible de déploiement.
//
// Aucun secret n'est stocké ici : hôte, login et mot de passe sont injectés à
// la volée par variables d'environnement au moment du déploiement.
//
//   Bash :
//     FTP_HOST='ftp.clusterXXX.hosting.ovh.net' FTP_USER='...' FTP_PASSWORD='...' npm run deploy:ovh
//   PowerShell :
//     $env:FTP_HOST='ftp.clusterXXX.hosting.ovh.net'; $env:FTP_USER='...'; $env:FTP_PASSWORD='...'; npm run deploy:ovh
//
// L'hôte et le login ne sont pas confidentiels (ils seront connus une fois
// l'hébergement gratuit provisionné sur le domaine) ; le mot de passe, lui, ne
// doit jamais toucher le disque (lien secret OVH à usage unique, mémoire seule).

import { Client } from 'basic-ftp';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '..', 'out');

const config = {
  host: process.env.FTP_HOST,
  user: process.env.FTP_USER,
  password: process.env.FTP_PASSWORD,
  port: Number(process.env.FTP_PORT || 21),
  remoteDir: process.env.FTP_REMOTE_DIR || '/www',
  // L'offre gratuite OVH ne supporte pas le FTPS explicite (« 500 This security
  // scheme is not implemented »). FTP simple par défaut, comme pour heterostasia.
  secure: process.env.FTP_SECURE === 'true',
};

const missing = ['host', 'user', 'password'].filter((k) => !config[k]);
if (missing.length) {
  console.error(
    `Erreur : variables manquantes (${missing
      .map((k) => 'FTP_' + k.toUpperCase())
      .join(', ')}). Injecte-les à la volée, ne les stocke pas.`,
  );
  process.exit(1);
}

if (!existsSync(OUT)) {
  console.error('Erreur : dossier out/ introuvable. Lance d’abord `npm run build`.');
  process.exit(1);
}

const client = new Client(30000);
client.ftp.verbose = false;

try {
  await client.access({
    host: config.host,
    user: config.user,
    password: config.password,
    port: config.port,
    secure: config.secure,
    secureOptions: { rejectUnauthorized: false },
  });
  console.log(`Connecté à ${config.host} (FTPS=${config.secure}). Upload de out/ vers ${config.remoteDir} …`);
  await client.ensureDir(config.remoteDir);
  await client.clearWorkingDir();
  await client.uploadFromDir(OUT);
  console.log('Déploiement terminé.');
} catch (err) {
  console.error('Échec du déploiement :', err.message);
  process.exitCode = 1;
} finally {
  client.close();
}
