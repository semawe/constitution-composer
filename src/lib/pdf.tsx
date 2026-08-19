// Génération du PDF de la version composée. Chargé à la demande (import dynamique)
// pour ne pas alourdir le bundle initial. Texte vectoriel sélectionnable.

import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  Image,
  Font,
  StyleSheet,
  pdf,
} from "@react-pdf/renderer";
import { type ConstitutionData, type Tier, compose } from "./constitution";
import { parseBlocks, parseInline } from "./markup";
import { releaseLabel, shortSha } from "./releases";
import { COMPOSER, PRINCIPES_UI, type Locale } from "./i18n";

// Polices du document, auto-hébergées dans /public/fonts (mêmes fichiers que
// les @font-face de globals.css). Enregistrées à la demande, une seule fois.
const PDF_FONTS: Record<string, string> = {
  "source-serif": "Source Serif 4",
  "eb-garamond": "EB Garamond",
  lora: "Lora",
  inter: "Inter",
  "ibm-plex": "IBM Plex Sans",
};
const FONT_FILE: Record<string, string> = {
  "source-serif": "source-serif",
  "eb-garamond": "eb-garamond",
  lora: "lora",
  inter: "inter",
  "ibm-plex": "ibm-plex",
};
/**
 * Face italique effective. Aucune des cinq polices embarquées n'a de variante
 * italique (elles sont enregistrées en 400 et 700 seulement) et @react-pdf ne
 * synthétise pas l'oblique : demander `fontStyle: "italic"` le fait JETER
 * (« Could not resolve font … fontStyle italic »), ce qui interrompt l'export
 * sans rien produire. On bascule donc sur les faces italiques intégrées au
 * format PDF, qui ne demandent aucun enregistrement. Le jour où les fichiers
 * italiques des cinq familles sont embarqués, c'est ici que ça se règle.
 */
const ITALIC_FACE: Record<string, string> = {
  "source-serif": "Times-Italic",
  "eb-garamond": "Times-Italic",
  lora: "Times-Italic",
  inter: "Helvetica-Oblique",
  "ibm-plex": "Helvetica-Oblique",
};
function italicFace(font?: string): string {
  return ITALIC_FACE[font ?? "source-serif"] ?? "Times-Italic";
}

let fontsRegistered = false;
function ensureFonts() {
  if (fontsRegistered) return;
  for (const key of Object.keys(PDF_FONTS)) {
    const file = FONT_FILE[key];
    Font.register({
      family: PDF_FONTS[key],
      fonts: [
        { src: `/fonts/${file}-400.woff`, fontWeight: 400 },
        { src: `/fonts/${file}-700.woff`, fontWeight: 700 },
      ],
    });
  }
  fontsRegistered = true;
}

const COLOR: Record<Tier | "warning" | "ink" | "muted" | "rule" | "title", string> = {
  core: "#334155",
  retirable: "#0d9488",
  pedagogique: "#d97706",
  extension: "#7c3aed",
  app: "#be123c",
  warning: "#b45309",
  ink: "#1f2937",
  muted: "#64748b",
  rule: "#e2e8f0",
  title: "#0f172a",
};

const styles = StyleSheet.create({
  page: {
    paddingTop: 48,
    paddingBottom: 56,
    paddingHorizontal: 56,
    fontFamily: "Times-Roman",
    fontSize: 11,
    color: COLOR.ink,
    lineHeight: 1.5,
  },
  kicker: {
    fontFamily: "Helvetica",
    fontSize: 8,
    letterSpacing: 2,
    color: COLOR.muted,
    marginBottom: 4,
  },
  title: {
    fontWeight: 700,
    fontSize: 22,
    marginBottom: 4,
    color: COLOR.title,
  },
  date: {
    fontFamily: "Helvetica",
    fontSize: 9,
    color: COLOR.muted,
    marginBottom: 18,
  },
  h2: {
    fontWeight: 700,
    fontSize: 15,
    marginTop: 18,
    marginBottom: 6,
    color: COLOR.title,
  },
  valuesHeading: {
    fontWeight: 700,
    fontSize: 12,
    marginTop: 10,
    marginBottom: 4,
    color: COLOR.ink,
  },
  para: { marginBottom: 6 },
  bold: { fontWeight: 700 },
  intent: {
    fontSize: 10,
    color: COLOR.muted,
    borderLeftWidth: 2,
    borderLeftColor: COLOR.rule,
    paddingLeft: 8,
    marginBottom: 8,
  },
  listItem: { flexDirection: "row", marginBottom: 2, paddingLeft: 8 },
  listMarker: { width: 16 },
  listBody: { flex: 1 },
  insertion: {
    marginTop: 8,
    marginBottom: 4,
    paddingLeft: 10,
    paddingVertical: 2,
    borderLeftWidth: 3,
  },
  tag: { fontFamily: "Helvetica", fontSize: 8, marginBottom: 3 },
  footer: {
    position: "absolute",
    bottom: 28,
    left: 56,
    right: 56,
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: COLOR.rule,
    paddingTop: 8,
  },
  docLogo: { height: 44, marginBottom: 12, objectFit: "contain" },
  devise: { fontSize: 12, color: COLOR.muted, marginBottom: 10 },
  intro: { color: COLOR.muted, marginBottom: 14 },
  h3: { fontWeight: 700, fontSize: 12, marginTop: 12, marginBottom: 3, color: COLOR.title },
  signHeading: {
    fontFamily: "Helvetica",
    fontSize: 8,
    letterSpacing: 1,
    color: COLOR.muted,
    marginTop: 14,
    marginBottom: 6,
  },
  signRow: { flexDirection: "row", alignItems: "flex-end", marginBottom: 12 },
  signName: { width: 160, fontSize: 11 },
  signLine: {
    flex: 1,
    borderBottomWidth: 1,
    borderBottomColor: COLOR.rule,
    height: 14,
  },
  footerLogo: { width: 16, marginRight: 6 },
  footerText: {
    flex: 1,
    fontFamily: "Helvetica",
    fontSize: 8,
    color: COLOR.muted,
  },
});

// Gras et italique lus par la grammaire commune (`src/lib/markup.ts`), la même
// que le rendu HTML : c'est la copie divergente de cet analyseur qui faisait
// sortir les astérisques de l'italique en clair dans le PDF.
function runs(text: string, italic: string) {
  return parseInline(text).map((seg, i) => {
    if (seg.emphasis === "bold")
      return (
        <Text key={i} style={styles.bold}>
          {seg.text}
        </Text>
      );
    if (seg.emphasis === "italic")
      return (
        <Text key={i} style={{ fontFamily: italic }}>
          {seg.text}
        </Text>
      );
    return <Text key={i}>{seg.text}</Text>;
  });
}

function paragraphs(text: string, italic: string) {
  return parseBlocks(text).map((bloc, i) => {
    if (bloc.kind === "paragraph")
      return (
        <Text key={i} style={styles.para}>
          {runs(bloc.text, italic)}
        </Text>
      );
    const items =
      bloc.kind === "bullets"
        ? bloc.items.map((texte) => ({ marker: "\u2022", texte }))
        : bloc.items.map((item) => ({ marker: item.marker, texte: item.text }));
    return (
      <View key={i} style={styles.para}>
        {items.map((item, j) => (
          <View key={j} style={styles.listItem}>
            <Text style={styles.listMarker}>{item.marker}</Text>
            <Text style={styles.listBody}>{runs(item.texte, italic)}</Text>
          </View>
        ))}
      </View>
    );
  });
}

/**
 * Exporté pour être éprouvé : c'est la seule couture par laquelle un test peut
 * vérifier que tout ce que `compose()` produit atteint bien le document, sans
 * faire tourner le moteur PDF (qui réclame les polices et un réseau).
 */
export function ComposedDoc({
  data,
  active,
  title,
  values,
  date,
  titleColor,
  font,
  logo,
  locale = "fr",
  showIntent = true,
  contentRef,
}: {
  data: ConstitutionData;
  active: ReadonlySet<string>;
  title: string;
  values: string;
  date?: string;
  titleColor?: string;
  font?: string;
  logo?: string;
  locale?: Locale;
  /** Notes d'intention : l'export suit l'interrupteur de l'écran (affiché par défaut). */
  showIntent?: boolean;
  /**
   * Release du fond et son empreinte : imprimées en pied de page pour qu'on
   * puisse dire, plus tard, de quel texte ce document a été tiré. Absentes pour
   * une composition qui n'est figée sur aucune release.
   */
  contentRef?: { release: string; sha256: string };
}) {
  const t = COMPOSER[locale];
  const items = compose(data, active);
  const fam = PDF_FONTS[font ?? "source-serif"] ?? "Source Serif 4";
  const italic = italicFace(font);
  return (
    <Document title={title}>
      <Page size="A4" style={[styles.page, { fontFamily: fam }]}>
        {logo ? (
          // eslint-disable-next-line jsx-a11y/alt-text
          <Image style={styles.docLogo} src={logo} />
        ) : null}
        <Text style={styles.kicker}>{(data.meta.version ?? "").toUpperCase()}</Text>
        <Text style={[styles.title, titleColor ? { color: titleColor } : {}]}>
          {title}
        </Text>
        {date && (
          <Text style={styles.date}>
            {t.pdfComposedOn} {date}
          </Text>
        )}

        {items.map((it) => {
          if (it.kind === "block") {
            return (
              <View key={it.key}>
                {it.heading && <Text style={styles.h2}>{it.heading}</Text>}
                {showIntent && it.intent ? (
                  <Text style={[styles.intent, { fontFamily: italic }]}>
                    {it.intent}
                  </Text>
                ) : null}
                {paragraphs(it.text, italic)}
                {it.key === "block:preambule" && values.trim() && (
                  <View>
                    <Text style={styles.valuesHeading}>{t.pdfValuesHeading}</Text>
                    {paragraphs(values, italic)}
                  </View>
                )}
              </View>
            );
          }
          const color = it.warning ? COLOR.warning : COLOR[it.tier];
          const tag = it.warning
            ? t.pdfDefaultRule(it.moduleLabel ?? "")
            : it.tier === "retirable"
              ? `${it.moduleLabel}`
              : `+ ${it.moduleLabel}`;
          return (
            <View key={it.key} style={[styles.insertion, { borderLeftColor: color }]}>
              <Text style={[styles.tag, { color }]}>{tag}</Text>
              {paragraphs(it.text, italic)}
            </View>
          );
        })}

        <View style={styles.footer} fixed>
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <Image style={styles.footerLogo} src="/logo-semawe-light.png" />
          <Text style={styles.footerText}>
            {t.pdfFooter(data.meta.license, data.meta.notice)}
            {contentRef
              ? ` — ${t.pdfContentRef(releaseLabel(contentRef.release, locale), shortSha(contentRef.sha256))}`
              : ""}
          </Text>
        </View>
      </Page>
    </Document>
  );
}

export interface PrincipesPdfData {
  meta: Record<string, string>;
  intro: string;
  raisonEtre?: string;
  devise?: string;
  adoptionText: string;
  items: { n: number; title: string; text: string }[];
  ratifiers: string[];
  signatories: string[];
  logo?: string;
  font?: string;
  titleColor?: string;
  locale?: Locale;
  /**
   * Release des Principes et son empreinte, imprimées en pied de page : la
   * Déclaration est signée, on doit pouvoir dire de quels Principes elle est
   * faite.
   */
  contentRef?: { release: string; sha256: string };
}

function SignatureList({ names }: { names: string[] }) {
  return (
    <>
      {names.map((name, i) => (
        <View key={i} style={styles.signRow}>
          <Text style={styles.signName}>{name}</Text>
          <View style={styles.signLine} />
        </View>
      ))}
    </>
  );
}

/** Exporté pour la même raison que `ComposedDoc` : c'est la couture d'épreuve. */
export function PrincipesDoc({ d }: { d: PrincipesPdfData }) {
  const t = PRINCIPES_UI[d.locale ?? "fr"];
  const fam = PDF_FONTS[d.font ?? "source-serif"] ?? "Source Serif 4";
  const italic = italicFace(d.font);
  return (
    <Document title={d.meta.title}>
      <Page size="A4" style={[styles.page, { fontFamily: fam }]}>
        {d.logo ? (
          // eslint-disable-next-line jsx-a11y/alt-text
          <Image style={styles.docLogo} src={d.logo} />
        ) : null}
        <Text style={styles.kicker}>{(d.meta.version ?? "").toUpperCase()}</Text>
        <Text style={[styles.title, d.titleColor ? { color: d.titleColor } : {}]}>
          {d.meta.title}
        </Text>
        {d.devise ? (
          <Text style={[styles.devise, { fontFamily: italic }]}>« {d.devise} »</Text>
        ) : null}
        {d.raisonEtre ? (
          <View>
            <Text style={styles.valuesHeading}>{t.pdfPurpose}</Text>
            {paragraphs(d.raisonEtre, italic)}
          </View>
        ) : null}
        <Text style={[styles.intro, { fontFamily: italic }]}>{d.intro}</Text>

        {d.items.map((it, i) => (
          <View key={i}>
            <Text style={styles.h3}>
              {it.n}. {it.title}
            </Text>
            {it.text ? paragraphs(it.text, italic) : null}
          </View>
        ))}

        <Text style={styles.h2}>{t.adoption}</Text>
        {paragraphs(d.adoptionText, italic)}
        {d.ratifiers.length > 0 && (
          <View>
            <Text style={styles.signHeading}>
              {t.pdfRatifiers.toUpperCase()}
            </Text>
            <SignatureList names={d.ratifiers} />
          </View>
        )}
        {d.signatories.length > 0 && (
          <View>
            <Text style={styles.signHeading}>
              {t.pdfSignatories.toUpperCase()}
            </Text>
            <SignatureList names={d.signatories} />
          </View>
        )}

        <View style={styles.footer} fixed>
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <Image style={styles.footerLogo} src="/logo-semawe-light.png" />
          <Text style={styles.footerText}>
            {t.footer(d.meta.license, d.meta.notice)}
            {d.contentRef
              ? ` — ${COMPOSER[d.locale ?? "fr"].pdfContentRef(
                  releaseLabel(d.contentRef.release, d.locale ?? "fr"),
                  shortSha(d.contentRef.sha256),
                )}`
              : ""}
          </Text>
        </View>
      </Page>
    </Document>
  );
}

export async function generatePrincipesPdfBlob(
  d: PrincipesPdfData,
): Promise<Blob> {
  ensureFonts();
  return pdf(<PrincipesDoc d={d} />).toBlob();
}

export async function generateComposedPdfBlob(
  data: ConstitutionData,
  active: ReadonlySet<string>,
  opts?: {
    title?: string;
    values?: string;
    date?: string;
    titleColor?: string;
    font?: string;
    logo?: string;
    locale?: Locale;
    showIntent?: boolean;
    contentRef?: { release: string; sha256: string };
  },
): Promise<Blob> {
  const title = opts?.title?.trim() || data.meta.title;
  const values = opts?.values ?? "";
  ensureFonts();
  return pdf(
    <ComposedDoc
      data={data}
      active={active}
      title={title}
      values={values}
      date={opts?.date}
      titleColor={opts?.titleColor}
      font={opts?.font}
      logo={opts?.logo}
      locale={opts?.locale}
      showIntent={opts?.showIntent}
      contentRef={opts?.contentRef}
    />,
  ).toBlob();
}
