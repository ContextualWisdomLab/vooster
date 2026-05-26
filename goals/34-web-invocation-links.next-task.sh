#!/usr/bin/env bash

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

GATE="goals/34-web-invocation-links.gates.sh"
DATA='apps/app/app/data.tsx'
STUB='apps/app/app/data.stub.tsx'
DETAIL_PAGE='apps/app/app/(app)/projects/[key]/usecases/[ucKey]/page.tsx'

if bash "$ROOT/$GATE" >/dev/null 2>&1; then
  cat <<'MSG'
TASK: Goal 34 is green.
  - Run pnpm --filter @vooster/app test.
  - Run pnpm --filter @vooster/app typecheck.
  - Run bash scripts/completion-check.sh.
  - Return to docs/findings/2026-05-26T1504-usecase-invocation-links.md Stage 2.
MSG
  exit 0
fi

if ! grep -q "invokes" "$DATA" || ! grep -q "invoked_by" "$DATA"; then
  cat <<'MSG'
TASK: Teach the web detail data contract about invocation links.
  - Add invokes: string[] to use-case detail steps.
  - Add the derived invoked_by list to the use-case detail shape.
  - Keep the data fetcher read-only; do not add backend endpoints.
MSG
  exit 0
fi

if ! grep -q "invokes" "$STUB" || ! grep -q "invoked_by" "$STUB"; then
  cat <<'MSG'
TASK: Add inspectable invocation examples to auth-stub detail data.
  - Include at least one step with invoked use-case keys.
  - Include at least one invoked_by caller entry for a detail page.
MSG
  exit 0
fi

if ! grep -q "호출됨" "$DETAIL_PAGE" || ! grep -q "invoked_by" "$DETAIL_PAGE"; then
  cat <<'MSG'
TASK: Render invocation links on the use-case detail page.
  - Show step-level "호출" information only when a step has invokes.
  - Show a "호출됨" section from invoked_by.
  - Reuse existing quiet viewer styling and terminology components.
MSG
  exit 0
fi

cat <<'MSG'
TASK: Finish verification for Goal 34.
  - Run web unit tests and typecheck.
  - Run bash goals/34-web-invocation-links.gates.sh and fix remaining output.
MSG
