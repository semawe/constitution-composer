import { type ChangeEvent } from "react";
import { FONT_OPTIONS } from "@/lib/branding";
import { type COMPOSER } from "@/lib/i18n";

// L'identité visuelle du document : police, logo, couleur du titre.
//
// Ces trois réglages vivaient dans le fronton du document, en onze pixels, entre
// le titre éditable et l'avancement — cinq registres empilés dans cent pixels.
// Les replier les avait déjà empêchés de disputer l'attention au titre ; ils n'en
// avaient pas pour autant quitté le fronton, qui n'a à porter que ce dont le
// document est fait : son édition, son titre, sa dérivation.
//
// Ce sont des commandes d'atelier, et l'atelier est le rail. Repliés là aussi :
// on y touche une fois, quand le document est composé, pas à chaque geste.
//
// Le rail étant étroit, les trois réglages s'y empilent au lieu de se suivre sur
// une ligne — c'est le seul écart avec la version du fronton.

type Ui = (typeof COMPOSER)["fr"];

export function ComposerIdentite({
  t,
  logo,
  onLogoChange,
  setLogo,
  font,
  setFont,
  titleColor,
  setTitleColor,
}: {
  t: Ui;
  logo: string;
  onLogoChange: (e: ChangeEvent<HTMLInputElement>) => void;
  setLogo: (v: string) => void;
  font: string;
  setFont: (v: string) => void;
  titleColor: string;
  setTitleColor: (v: string) => void;
}) {
  return (
    <div className="space-y-3 text-xs text-muted">
      <p className="text-muted">{t.identityHint}</p>

      <label className="block">
        <span className="block">{t.fontLabel}</span>
        <select
          value={font}
          onChange={(e) => setFont(e.target.value)}
          aria-label="Police du document"
          className="mt-1 w-full rounded border border-field bg-transparent px-1.5 py-1 outline-none focus:border-field-accent"
        >
          {FONT_OPTIONS.map((f) => (
            <option key={f.key} value={f.key}>
              {f.label}
            </option>
          ))}
        </select>
      </label>

      <div>
        <span className="block">Logo</span>
        <div className="mt-1 flex items-center gap-2">
          <label className="cursor-pointer underline transition hover:text-body">
            {logo ? t.logoChange : t.logoAdd}
            <input
              type="file"
              accept="image/*"
              onChange={onLogoChange}
              className="hidden"
            />
          </label>
          {logo && (
            <button
              onClick={() => setLogo("")}
              className="underline transition hover:text-body"
            >
              {t.logoRemove}
            </button>
          )}
        </div>
      </div>

      <div>
        <span className="block">{t.colorLabel}</span>
        <div className="mt-1 flex items-center gap-2">
          <input
            type="color"
            value={titleColor || "#0f172a"}
            onChange={(e) => setTitleColor(e.target.value)}
            aria-label="Couleur du titre"
            className="h-6 w-7 shrink-0 cursor-pointer rounded border border-field bg-transparent p-0"
          />
          <input
            type="text"
            value={titleColor}
            onChange={(e) => setTitleColor(e.target.value)}
            placeholder="#0f172a"
            spellCheck={false}
            className="min-w-0 flex-1 rounded border border-field bg-transparent px-1.5 py-1 font-mono outline-none focus:border-field-accent"
          />
          {titleColor && (
            <button
              onClick={() => setTitleColor("")}
              className="shrink-0 underline transition hover:text-body"
            >
              {t.colorReset}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
