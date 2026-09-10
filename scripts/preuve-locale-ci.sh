#!/usr/bin/env bash

set -eu

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
sha="$(git -C "$repo_root" rev-parse HEAD)"
[ "${#sha}" -eq 40 ]
[ -z "$(git -C "$repo_root" status --porcelain)" ]
[ "$(node -p 'process.versions.node.split(`.`)[0]')" = "24" ]

proof_root="${SEMAWE_PROOF_DIR:-$repo_root/var/proofs}"
mkdir -p "$proof_root"
chmod 700 "$proof_root"
report="$proof_root/constitution-composer-$sha.txt"
[ ! -e "$report" ]
umask 077

checkout="$(mktemp -d)"
trap 'rm -rf "$checkout"' EXIT
git clone --quiet --no-local "$repo_root" "$checkout/source"
git -C "$checkout/source" checkout --quiet --detach "$sha"
git -C "$checkout/source" submodule update --init --recursive --quiet

{
  echo "sha=$sha"
  echo "node=$(node --version)"
  echo "source_clean=true"
  cd "$checkout/source"
  node scripts/test-actions-budget.mjs
  npm ci --ignore-scripts
  npm run fond:check
  npm run release:check
  npm test
  npx tsc --noEmit
  npm run lint
  NEXT_PUBLIC_ALLOW_DEMO_MODE=true npm run build
  npm run export:check
  echo "resultat=VERT"
} > "$report" 2>&1

chmod 600 "$report"
printf '%s\n' "$report"
