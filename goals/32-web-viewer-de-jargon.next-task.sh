#!/usr/bin/env bash

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

GOAL="goals/32-web-viewer-de-jargon.gates.sh"
PROJECT_PAGE='apps/app/app/(app)/projects/[key]/page.tsx'
DETAIL_PAGE='apps/app/app/(app)/projects/[key]/usecases/[ucKey]/page.tsx'
STATUS_PILL='apps/app/app/components/StatusPill.tsx'
LABELS='apps/app/lib/labels.ts'

if bash "$ROOT/$GOAL" >/dev/null 2>&1; then
  cat <<'MSG'
TASK: Goal 32 is green.
  - Run pnpm --filter @vooster/app test.
  - Run pnpm --filter @vooster/app typecheck.
  - Run bash scripts/completion-check.sh.
  - Resolve docs/findings/2026-05-25T1503-web-viewer-de-jargon.md.
MSG
  exit 0
fi

if [ ! -f "$LABELS" ]; then
  cat <<'MSG'
TASK: Add the web terminology label source.
  - In apps/app, add a labels/glossary module for canonical Korean labels.
  - Cover level and status enum labels exhaustively.
  - Include glossary descriptions for actor, level, main scenario, extension, and stakeholder interest.
MSG
  exit 0
fi

if ! grep -q "IN_REVIEW" "$STATUS_PILL" "$LABELS" 2>/dev/null \
  || grep -Eq "READY|IN_PROGRESS|DONE|BLOCKED" "$STATUS_PILL" 2>/dev/null; then
  cat <<'MSG'
TASK: Align StatusPill with the spec status enum.
  - Present DRAFT, IN_REVIEW, APPROVED, and DEPRECATED with stable Korean labels.
  - Remove legacy status assumptions from the pill.
MSG
  exit 0
fi

if ! grep -Rqs "TermLabel" apps/app/app apps/app/components apps/app/lib 2>/dev/null; then
  cat <<'MSG'
TASK: Add the glossary label affordance.
  - Provide a small term label component that pairs a canonical label with a question-mark popover.
  - Keep it inside apps/app and keep pages read-only.
MSG
  exit 0
fi

if perl -0ne '
  if (/>[[:space:]]*(Use cases|primary_actor|main_scenario|extensions|stakeholder_interests)[[:space:]]*</ || /\{[[:space:]]*(usecase\.)?level[[:space:]]*\}/) {
    exit 0
  }
  END { exit 1 }
' "$PROJECT_PAGE" "$DETAIL_PAGE"; then
  cat <<'MSG'
TASK: Replace raw viewer labels in project and use-case pages.
  - Use canonical Korean labels for use-case concepts.
  - Show glossary help where the finding calls for on-demand descriptions.
  - Do not add new data fetching or write affordances.
MSG
  exit 0
fi

cat <<'MSG'
TASK: Finish verification for Goal 32.
  - Run the web unit tests and typecheck.
  - Run bash goals/32-web-viewer-de-jargon.gates.sh and fix any remaining gate output.
MSG
