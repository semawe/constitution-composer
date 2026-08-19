import { type ChangeEvent } from "react";

/**
 * Redimensionne le logo choisi et le rend en data URL.
 *
 * Sorti de `Composer.tsx` (#1057). Le redimensionnement n'est pas cosmétique :
 * le logo voyage dans le payload d'une composition, et une image brute y pèserait
 * des mégaoctets — ce que la base borne désormais (migration 0008).
 */
export function chargerLogo(
  e: ChangeEvent<HTMLInputElement>,
  setLogo: (v: string) => void,
) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new window.Image();
      img.onload = () => {
        const max = 400;
        let { width, height } = img;
        if (width > max || height > max) {
          const r = Math.min(max / width, max / height);
          width = Math.round(width * r);
          height = Math.round(height * r);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d")?.drawImage(img, 0, 0, width, height);
        setLogo(canvas.toDataURL("image/png"));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  }
