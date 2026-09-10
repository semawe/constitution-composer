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

console.log("PASS actions_bornees_sans_evenement_non_borne");
