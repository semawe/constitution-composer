// Génération du PDF de la version composée. Chargé à la demande (import dynamique)
// pour ne pas alourdir le bundle initial. Texte vectoriel sélectionnable.

import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  pdf,
} from "@react-pdf/renderer";
import { type ConstitutionData, type Tier, compose } from "./constitution";

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
    fontFamily: "Times-Bold",
    fontSize: 22,
    marginBottom: 18,
    color: COLOR.title,
  },
  h2: {
    fontFamily: "Times-Bold",
    fontSize: 15,
    marginTop: 18,
    marginBottom: 6,
    color: COLOR.title,
  },
  valuesHeading: {
    fontFamily: "Times-Bold",
    fontSize: 12,
    marginTop: 10,
    marginBottom: 4,
    color: COLOR.ink,
  },
  para: { marginBottom: 6 },
  bold: { fontFamily: "Times-Bold" },
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
    fontFamily: "Helvetica",
    fontSize: 8,
    color: COLOR.muted,
    borderTopWidth: 1,
    borderTopColor: COLOR.rule,
    paddingTop: 8,
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
  return text.split(/\n\n/).map((p, i) => (
    <Text key={i} style={styles.para}>
      {runs(p)}
    </Text>
  ));
}

function ComposedDoc({
  data,
  active,
  title,
  values,
}: {
  data: ConstitutionData;
  active: ReadonlySet<string>;
  title: string;
  values: string;
}) {
  const items = compose(data, active);
  return (
    <Document title={title}>
      <Page size="A4" style={styles.page}>
        <Text style={styles.kicker}>{(data.meta.version ?? "").toUpperCase()}</Text>
        <Text style={styles.title}>{title}</Text>

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
            : `+ ${it.moduleLabel}`;
          return (
            <View key={it.key} style={[styles.insertion, { borderLeftColor: color }]}>
              <Text style={[styles.tag, { color }]}>{tag}</Text>
              {paragraphs(it.text)}
            </View>
          );
        })}

        <Text style={styles.footer} fixed>
          {data.meta.notice} — {data.meta.license}
        </Text>
      </Page>
    </Document>
  );
}

export async function generateComposedPdfBlob(
  data: ConstitutionData,
  active: ReadonlySet<string>,
  opts?: { title?: string; values?: string },
): Promise<Blob> {
  const title = opts?.title?.trim() || data.meta.title;
  const values = opts?.values ?? "";
  return pdf(
    <ComposedDoc data={data} active={active} title={title} values={values} />,
  ).toBlob();
}
