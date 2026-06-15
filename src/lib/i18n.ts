export type Locale = "fr" | "en";

export function getLocaleFromPath(pathname: string): Locale {
  return pathname.startsWith("/en") ? "en" : "fr";
}

export function toOtherLocale(pathname: string): string {
  if (pathname.startsWith("/en")) {
    const stripped = pathname.slice(3) || "/";
    return stripped || "/";
  }
  return "/en" + (pathname === "/" ? "" : pathname);
}

export const UI = {
  fr: {
    nav: {
      composer: "Composer",
      cartographie: "Cartographie",
      comprendre: "Comprendre",
      login: "Se connecter",
    },
    footer: {
      tagline: "Constitution Composer, un outil Sémawé.",
    },
  },
  en: {
    nav: {
      composer: "Composer",
      cartographie: "Directory",
      comprendre: "Learn",
      login: "Sign in",
    },
    footer: {
      tagline: "Constitution Composer, a Sémawé tool.",
    },
  },
} satisfies Record<Locale, unknown>;
