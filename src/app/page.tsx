import App from "@/components/App";
import type { ConstitutionData } from "@/lib/constitution";
import type { PrincipesData } from "@/components/Principes";
import constitutionRaw from "@/data/constitution.fr.json";
import principesRaw from "@/data/principes.fr.json";

const constitution = constitutionRaw as ConstitutionData;
const principes = principesRaw as PrincipesData;

export default function Home() {
  return <App constitution={constitution} principes={principes} />;
}
