"use client";

import { useState } from "react";
import Composer from "@/components/Composer";
import Principes, { type PrincipesData } from "@/components/Principes";
import type { ConstitutionData } from "@/lib/constitution";

function tabClass(active: boolean) {
  return `rounded-full px-4 py-1.5 text-sm font-medium transition ${
    active ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-100"
  }`;
}

export default function App({
  constitution,
  principes,
}: {
  constitution: ConstitutionData;
  principes: PrincipesData;
}) {
  const [view, setView] = useState<"constitution" | "principes">("constitution");

  return (
    <div>
      <nav className="sticky top-0 z-40 flex h-11 items-center justify-center gap-1 border-b border-slate-200 bg-background/90 backdrop-blur">
        <button
          onClick={() => setView("constitution")}
          className={tabClass(view === "constitution")}
        >
          Constitution
        </button>
        <button
          onClick={() => setView("principes")}
          className={tabClass(view === "principes")}
        >
          Déclaration de Principes
        </button>
      </nav>

      {view === "constitution" ? (
        <Composer data={constitution} />
      ) : (
        <Principes data={principes} />
      )}
    </div>
  );
}
