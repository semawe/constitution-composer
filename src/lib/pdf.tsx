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
  integral: "#0d9488",
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
  devise: { fontSize: 12, fontStyle: "italic", color: COLOR.muted, marginBottom: 10 },
  intro: { fontStyle: "italic", color: COLOR.muted, marginBottom: 14 },
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

function runs(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <Text key={i} style={styles.bold}>
        {part.slice(2, -2)}
      </Text>
    ) : (
      <Text key={i}>{part}</Text>
    ),
  );
}

function paragraphs(text: string) {
  return text.split(/\n\n/).map((chunk, i) => {
    const lines = chunk.split("\n");
    const isBullet = lines.length > 1 && lines.every((l) => /^- /.test(l.trim()));
    const isNum = lines.length > 1 && lines.every((l) => /^\d+\.\s/.test(l.trim()));
    if (isBullet || isNum) {
      return (
        <View key={i} style={styles.para}>
          {lines.map((l, j) => {
            const t = l.trim();
            const marker = isBullet ? "•" : `${t.match(/^(\d+)\./)?.[1]}.`;
            const body = isBullet
              ? t.replace(/^- /, "")
              : t.replace(/^\d+\.\s/, "");
            return (
              <View key={j} style={styles.listItem}>
                <Text style={styles.listMarker}>{marker}</Text>
                <Text style={styles.listBody}>{runs(body)}</Text>
              </View>
            );
          })}
        </View>
      );
    }
    return (
      <Text key={i} style={styles.para}>
        {runs(chunk)}
      </Text>
    );
  });
}

function ComposedDoc({
  data,
  active,
  title,
  values,
  date,
  titleColor,
  font,
  logo,
}: {
  data: ConstitutionData;
  active: ReadonlySet<string>;
  title: string;
  values: string;
  date?: string;
  titleColor?: string;
  font?: string;
  logo?: string;
}) {
  const items = compose(data, active);
  const fam = PDF_FONTS[font ?? "source-serif"] ?? "Source Serif 4";
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
        {date && <Text style={styles.date}>Composé le {date}</Text>}

        {items.map((it) => {
          if (it.kind === "block") {
            return (
              <View key={it.key}>
                {it.heading && <Text style={styles.h2}>{it.heading}</Text>}
                {paragraphs(it.text)}
                {it.key === "block:preambule" && values.trim() && (
                  <View>
                    <Text style={styles.valuesHeading}>Valeurs et principes</Text>
                    {paragraphs(values)}
                  </View>
                )}
              </View>
            );
          }
          const color = it.warning ? COLOR.warning : COLOR[it.tier];
          const tag = it.warning
            ? `Règle par défaut — « ${it.moduleLabel} » non activé`
            : it.tier === "integral"
              ? `${it.moduleLabel}`
              : `+ ${it.moduleLabel}`;
          return (
            <View key={it.key} style={[styles.insertion, { borderLeftColor: color }]}>
              <Text style={[styles.tag, { color }]}>{tag}</Text>
              {paragraphs(it.text)}
            </View>
          );
        })}

        <View style={styles.footer} fixed>
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <Image style={styles.footerLogo} src="/logo-semawe-light.png" />
          <Text style={styles.footerText}>
            Composé avec le Composeur de Constitution de Sémawé, diffusé sous
            licence {data.meta.license}, dérivé de la Constitution Holacracy.{" "}
            {data.meta.notice}
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

function PrincipesDoc({ d }: { d: PrincipesPdfData }) {
  const fam = PDF_FONTS[d.font ?? "source-serif"] ?? "Source Serif 4";
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
        {d.devise ? <Text style={styles.devise}>« {d.devise} »</Text> : null}
        {d.raisonEtre ? (
          <View>
            <Text style={styles.valuesHeading}>Raison d&apos;Être</Text>
            {paragraphs(d.raisonEtre)}
          </View>
        ) : null}
        <Text style={styles.intro}>{d.intro}</Text>

        {d.items.map((it, i) => (
          <View key={i}>
            <Text style={styles.h3}>
              {it.n}. {it.title}
            </Text>
            {it.text ? paragraphs(it.text) : null}
          </View>
        ))}

        <Text style={styles.h2}>Adoption</Text>
        {paragraphs(d.adoptionText)}
        {d.ratifiers.length > 0 && (
          <View>
            <Text style={styles.signHeading}>RATIFICATEURS</Text>
            <SignatureList names={d.ratifiers} />
          </View>
        )}
        {d.signatories.length > 0 && (
          <View>
            <Text style={styles.signHeading}>SIGNATAIRES</Text>
            <SignatureList names={d.signatories} />
          </View>
        )}

        <View style={styles.footer} fixed>
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <Image style={styles.footerLogo} src="/logo-semawe-light.png" />
          <Text style={styles.footerText}>
            Déclaration de Principes composée avec le Composeur de Sémawé,
            diffusée sous licence {d.meta.license}, dérivée de la Constitution
            Holacracy. {d.meta.notice}
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
    />,
  ).toBlob();
}
