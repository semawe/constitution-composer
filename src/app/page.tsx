import Composer from "@/components/Composer";
import type { ConstitutionData } from "@/lib/constitution";
import raw from "@/data/constitution.fr.json";

const data = raw as ConstitutionData;

export default function Home() {
  return <Composer data={data} />;
}
