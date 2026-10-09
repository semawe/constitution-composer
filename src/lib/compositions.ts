// Sauvegarde des compositions (Phase B). Le service de comptes quand il est
// configuré et l'utilisateur connecté ; sinon repli localStorage (compte
// simulé / dev sans clés). Plafond ≤5 appliqué côté app ET côté base (trigger).

import { getService } from "./service";
import {
  type ContentRef,
  type Locale,
  canonicalRef,
  currentContentRef,
} from "./releases";

export interface CompositionPayload {
  /**
   * 2 depuis l'archivage des releases du fond. Absent = composition d'avant,
   * dont on ne peut rien garantir : elle n'est figée sur aucun texte.
   */
  schemaVersion?: 2;
  /**
   * Le fond dont cette composition est issue. C'est ce champ qui fait d'une
   * version un document plutôt qu'une configuration : sans lui, la rouvrir
   * après une retouche éditoriale rend un autre texte sous le même nom.
   */
  content?: ContentRef;
  title: string;
  values: string;
  active: string[]; // ids des blocs retirables / modules cochés
  titleColor?: string; // couleur du titre choisie (hex), vide = défaut du thème
  font?: string; // clé de la police du document (cf. FONT_OPTIONS)
  logo?: string; // logo de l'organisation, en data URL (redimensionné)
}

export interface SavedComposition {
  id: string;
  name: string;
  payload: CompositionPayload;
  updated_at: string;
}

export const MAX_COMPOSITIONS = 5;

const LS_KEY = "cc_versions";

function lsRead(): SavedComposition[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as SavedComposition[]) : [];
  } catch {
    return [];
  }
}

function lsWrite(rows: SavedComposition[]) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(rows));
  } catch {}
}

export async function listCompositions(): Promise<SavedComposition[]> {
  const service = getService();
  if (!service) return lsRead();
  return service.listerVersions();
}

/**
 * L'estampille se pose ici, à la frontière : aucun appelant ne peut sauvegarder
 * une composition sans dire de quel texte elle vient.
 *
 * `reference` est le fond **du document affiché**, pas celui du jour. Elle était
 * recalculée ici sur le texte courant et la langue de la page : enregistrer une
 * version relue sur une release ancienne la rattachait donc en silence au texte
 * du jour, et une composition anglaise ouverte depuis la route française
 * devenait française (audit du 04/10/2026, F01). Porter un document d'un texte
 * à un autre reste possible, mais c'est un geste à part : `migrateComposition()`.
 *
 * La référence n'est pas crue sur parole pour autant : elle doit désigner une
 * release que l'archive sait relire, avec son empreinte. Sinon on refuse
 * (« REFERENCE ») plutôt que d'inscrire une garantie qu'on ne pourrait pas tenir.
 * Ce que le payload prétend de lui-même (`payload.content`) est toujours ignoré.
 */
export async function saveComposition(
  name: string,
  payload: CompositionPayload,
  reference: ContentRef,
): Promise<SavedComposition> {
  const content = canonicalRef(reference, "constitution");
  if (!content) throw new Error("REFERENCE");
  payload = {
    ...payload,
    schemaVersion: 2,
    content,
  };
  const service = getService();
  if (!service) {
    const rows = lsRead();
    if (rows.length >= MAX_COMPOSITIONS) throw new Error("LIMIT");
    const row: SavedComposition = {
      id: crypto.randomUUID(),
      name,
      payload,
      updated_at: new Date().toISOString(),
    };
    lsWrite([row, ...rows]);
    return row;
  }
  return service.creerVersion(name, payload);
}

/**
 * Fige une composition existante sur le texte du jour, en place.
 *
 * Surtout pas « enregistrer puis supprimer » : au plafond de cinq versions, la
 * création échoue et la personne perd son geste sans comprendre ; et si la
 * suppression échoue après une création réussie, elle se retrouve avec un
 * doublon. Une mise à jour ne peut ni dépasser le plafond ni dédoubler.
 */
export async function repinComposition(
  id: string,
  payload: CompositionPayload,
  locale: Locale,
): Promise<void> {
  const fige: CompositionPayload = {
    ...payload,
    schemaVersion: 2,
    content: currentContentRef(locale),
  };
  const service = getService();
  if (!service) {
    lsWrite(
      lsRead().map((r) => (r.id === id ? { ...r, payload: fige } : r)),
    );
    return;
  }
  await service.remplacerVersion(id, fige);
}

/**
 * Rejoue une version sur le texte du jour, en **créant** une nouvelle version.
 *
 * C'est le pendant de `repinComposition()`, et la différence est le fond du
 * sujet : figer une version qui n'était rattachée à aucun texte ne lui enlève
 * rien, tandis que porter une version d'un texte à un autre change le document.
 * L'ancienne reste donc intacte — une organisation qui a adopté sa Constitution
 * doit pouvoir la relire telle qu'elle l'a ratifiée, même après avoir suivi une
 * version plus récente.
 *
 * Jette « LIMIT » si le plafond est atteint : il faut alors libérer une place,
 * et l'appelant le dit.
 */
export async function migrateComposition(
  source: SavedComposition,
  name: string,
  locale: Locale,
): Promise<SavedComposition> {
  const { schemaVersion: _s, content: _c, ...configuration } = source.payload;
  void _s;
  void _c;
  return saveComposition(
    name.slice(0, 120),
    configuration,
    currentContentRef(locale),
  );
}

export async function renameComposition(
  id: string,
  name: string,
): Promise<void> {
  const service = getService();
  if (!service) {
    lsWrite(lsRead().map((r) => (r.id === id ? { ...r, name } : r)));
    return;
  }
  await service.renommerVersion(id, name);
}

export async function deleteComposition(id: string): Promise<void> {
  const service = getService();
  if (!service) {
    lsWrite(lsRead().filter((r) => r.id !== id));
    return;
  }
  await service.supprimerVersion(id);
}
