// Les assertions de forme (« ce bouton est désactivé », « cet élément a le
// focus ») viennent de jest-dom : sans elles, un test d'interface énonce ses
// vérifications en détours illisibles.
import "@testing-library/jest-dom/vitest";

// Ce que jsdom n'a pas et que l'interface réclame.
//
// Les tests d'interaction montent le Composer, qui observe des intersections
// (scrollspy, animations à l'entrée dans le champ de vision), interroge les
// préférences de mouvement et fait défiler jusqu'à ce qui vient de changer.
// jsdom ne fournit rien de tout cela : sans ces bouchons, le montage échoue sur
// `IntersectionObserver is not defined` avant d'avoir rendu une ligne.
//
// Les bouchons sont volontairement inertes : ils rendent le montage possible,
// ils ne simulent pas le défilement. Ce qui dépend d'une animation réelle reste
// hors de portée d'un test (cf. l'observation du 18/08 : le panneau navigateur
// des sessions ne peint pas non plus).

class IntersectionObserverInerte implements IntersectionObserver {
  readonly root = null;
  readonly rootMargin = "";
  readonly thresholds: ReadonlyArray<number> = [];
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

class ResizeObserverInerte implements ResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

if (typeof globalThis.IntersectionObserver === "undefined")
  globalThis.IntersectionObserver =
    IntersectionObserverInerte as unknown as typeof IntersectionObserver;

if (typeof globalThis.ResizeObserver === "undefined")
  globalThis.ResizeObserver =
    ResizeObserverInerte as unknown as typeof ResizeObserver;

if (typeof window !== "undefined") {
  if (!window.matchMedia)
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;

  if (!Element.prototype.scrollIntoView)
    Element.prototype.scrollIntoView = function scrollIntoView() {};
}
