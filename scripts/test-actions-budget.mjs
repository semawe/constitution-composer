import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const expected = {
  "ci.yml": { cron: "7 4 * * 5", timeout: 10, job: "test" },
  "keep-alive.yml": { cron: "17 6 * * 1,4", timeout: 1, job: "ping" },
};

for (const [name, policy] of Object.entries(expected)) {
  const source = readFileSync(join(root, ".github", "workflows", name), "utf8");
  assert(source.includes(`cron: '${policy.cron}'`));
  assert(!/^\s+(pull_request|push|workflow_dispatch):/m.test(source));
  assert(source.includes(`  ${policy.job}:`));
  assert(source.includes("if: github.run_attempt == 1"));
  assert(source.includes(`timeout-minutes: ${policy.timeout}`));
}

// Preuve du serveur : jamais à la poussée ; seulement sur l'étiquette
// « preuve-serveur » posée à la main sur une PR, cinq minutes au plus, sans relance.
{
  const source = readFileSync(join(root, ".github", "workflows", "serveur.yml"), "utf8");
  assert(!/^\s+(push|workflow_dispatch|schedule|pull_request_target):/m.test(source));
  assert(/^\s+pull_request:\n\s+types: \[labeled\]\n/m.test(source));
  assert(source.includes("if: github.event.label.name == 'preuve-serveur' && github.run_attempt == 1"));
  assert(source.includes("timeout-minutes: 5"));
  assert(source.includes("image: postgres:15"));
}

console.log("PASS actions_bornees_sans_evenement_non_borne");
