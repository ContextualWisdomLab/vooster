#!/usr/bin/env bash

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

GATE="goals/33-project-overview-blueprint.gates.sh"
DATA='apps/app/app/data.tsx'
PAGE='apps/app/app/(app)/projects/[key]/page.tsx'

if bash "$ROOT/$GATE" >/dev/null 2>&1; then
  cat <<'MSG'
TASK: Goal 33 is green.
  - Run pnpm --filter @vooster/app test.
  - Run pnpm --filter @vooster/app typecheck.
  - Run bash scripts/completion-check.sh.
  - Update docs/findings/2026-05-25T1511-project-overview-blueprint.md.
MSG
  exit 0
fi

if ! grep -q "scenario_count" "$DATA" || ! grep -q "extension_count" "$DATA"; then
  cat <<'MSG'
TASK: Teach web data about overview counts.
  - Add scenario_count and extension_count to UsecaseSummary.
  - Keep the auth-stub demo data deterministic.
MSG
  exit 0
fi

if ! grep -q "fetchProjectActors" "$DATA"; then
  cat <<'MSG'
TASK: Add project actor fetching for the overview.
  - Reuse the existing project actors API surface.
  - Do not add a new backend endpoint.
MSG
  exit 0
fi

if ! grep -q "대비된 예외 상황" "$PAGE"; then
  cat <<'MSG'
TASK: Render the project overview blueprint.
  - Show substance counts for use cases, actors, and scenarios.
  - Show each use case row's exception count.
  - Show the total prepared exceptions block.
  - Reuse the existing terminology style from Goal 32.
MSG
  exit 0
fi

cat <<'MSG'
TASK: Finish verification for Goal 33.
  - Run the web unit tests and typecheck.
  - Run bash goals/33-project-overview-blueprint.gates.sh and fix remaining output.
MSG
