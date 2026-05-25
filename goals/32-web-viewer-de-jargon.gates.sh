#!/usr/bin/env bash
# goals/32-web-viewer-de-jargon.gates.sh — web viewer terminology invariant.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=../scripts/_gate-cache.sh
source "$ROOT/scripts/_gate-cache.sh"

GOAL_NAME="32-web-viewer-de-jargon"
GATE_INPUTS=(
  apps/web/app/components/StatusPill.tsx
  'apps/web/app/(app)/projects/[key]/page.tsx'
  'apps/web/app/(app)/projects/[key]/usecases/[ucKey]/page.tsx'
  apps/web/lib
  apps/web/tests/unit
  apps/web/package.json
  goals/32-web-viewer-de-jargon.md
  goals/32-web-viewer-de-jargon.gates.sh
  scripts/check-gate-rigor.sh
  scripts/_gate-cache.sh
)

if gate_cache_hit "$GOAL_NAME" "${GATE_INPUTS[@]}"; then
  echo "[cache hit] goal $GOAL_NAME inputs unchanged"
  exit 0
fi

PASS=true
PROJECT_PAGE='apps/web/app/(app)/projects/[key]/page.tsx'
DETAIL_PAGE='apps/web/app/(app)/projects/[key]/usecases/[ucKey]/page.tsx'
STATUS_PILL='apps/web/app/components/StatusPill.tsx'
LABELS='apps/web/lib/labels.ts'
WEB_FILES=("$PROJECT_PAGE" "$DETAIL_PAGE")

echo "[32.A1] raw use-case UI labels are absent from page text"
RAW_LABEL_HITS="$(mktemp -t vspec-goal32-raw-labels.XXXXXX)"
trap 'rm -f "$RAW_LABEL_HITS" "$RAW_ENUM_HITS"' EXIT
: >"$RAW_LABEL_HITS"
for file in "${WEB_FILES[@]}"; do
  if [ -f "$file" ]; then
    perl -0ne '
      while (/>[[:space:]]*(Use cases|primary_actor|main_scenario|extensions|stakeholder_interests)[[:space:]]*</g) {
        my $line = 1 + substr($_, 0, $-[0]) =~ tr/\n//;
        print "$ARGV:$line:$1\n";
      }
    ' "$file" >>"$RAW_LABEL_HITS"
  else
    echo "$file:missing page" >>"$RAW_LABEL_HITS"
  fi
done
if [ -s "$RAW_LABEL_HITS" ]; then
  echo "    ✗ fail — raw labels still appear in JSX text:"
  sed 's/^/        /' "$RAW_LABEL_HITS"
  PASS=false
else
  echo "    ✓ pass"
fi

echo "[32.A2] pages do not render raw level enum values directly"
RAW_ENUM_HITS="$(mktemp -t vspec-goal32-raw-enums.XXXXXX)"
: >"$RAW_ENUM_HITS"
for file in "${WEB_FILES[@]}"; do
  if [ -f "$file" ]; then
    grep -nE '\{[[:space:]]*(usecase\.)?level[[:space:]]*\}' "$file" >>"$RAW_ENUM_HITS" || true
  fi
done
if [ -s "$RAW_ENUM_HITS" ]; then
  echo "    ✗ fail — raw level values are still rendered:"
  sed 's/^/        /' "$RAW_ENUM_HITS"
  PASS=false
else
  echo "    ✓ pass"
fi

echo "[32.B1] StatusPill covers the spec status enum set"
if [ ! -f "$STATUS_PILL" ]; then
  echo "    ✗ fail — missing $STATUS_PILL"
  PASS=false
elif grep -Eq 'READY|IN_PROGRESS|DONE|BLOCKED' "$STATUS_PILL"; then
  echo "    ✗ fail — StatusPill still references legacy status enums"
  grep -nE 'READY|IN_PROGRESS|DONE|BLOCKED' "$STATUS_PILL" | sed 's/^/        /'
  PASS=false
else
  STATUS_TEXT="$(cat "$STATUS_PILL" "$LABELS" 2>/dev/null)"
  MISSING_STATUS=()
  for status in DRAFT IN_REVIEW APPROVED DEPRECATED; do
    if ! printf '%s\n' "$STATUS_TEXT" | grep -q "$status"; then
      MISSING_STATUS+=("$status")
    fi
  done
  if [ "${#MISSING_STATUS[@]}" -eq 0 ]; then
    echo "    ✓ pass"
  else
    echo "    ✗ fail — missing spec status mappings: ${MISSING_STATUS[*]}"
    PASS=false
  fi
fi

echo "[32.C1] labels.ts exhaustively maps level and status labels"
if [ ! -f "$LABELS" ]; then
  echo "    ✗ fail — missing $LABELS"
  PASS=false
else
  MISSING_LABELS=()
  for token in SUMMARY USER_GOAL SUBFUNCTION DRAFT IN_REVIEW APPROVED DEPRECATED; do
    if ! grep -q "$token" "$LABELS"; then
      MISSING_LABELS+=("$token")
    fi
  done
  for label in 요약 "사용자 목표" "하위 기능" 초안 "검토 중" 확정 폐기; do
    if ! grep -q "$label" "$LABELS"; then
      MISSING_LABELS+=("$label")
    fi
  done
  if [ "${#MISSING_LABELS[@]}" -eq 0 ]; then
    echo "    ✓ pass"
  else
    echo "    ✗ fail — labels.ts missing mappings: ${MISSING_LABELS[*]}"
    PASS=false
  fi
fi

echo "[32.D1] glossary descriptions exist for every required term"
if [ ! -f "$LABELS" ]; then
  echo "    ✗ fail — missing $LABELS"
  PASS=false
else
  MISSING_TERMS=()
  for term in "주요 액터" 레벨 "메인 시나리오" 확장 "이해관계자 관심사"; do
    if ! grep -q "$term" "$LABELS"; then
      MISSING_TERMS+=("$term")
    fi
  done
  for phrase in "사용자/시스템" "추상화 수준" "기본 성공 흐름" "벗어나는 조건" "가치가 보호"; do
    if ! grep -q "$phrase" "$LABELS"; then
      MISSING_TERMS+=("$phrase")
    fi
  done
  if [ "${#MISSING_TERMS[@]}" -eq 0 ]; then
    echo "    ✓ pass"
  else
    echo "    ✗ fail — glossary missing terms/descriptions: ${MISSING_TERMS[*]}"
    PASS=false
  fi
fi

echo "[32.D2] pages expose glossary terms with a question-mark affordance"
if grep -Rqs 'TermLabel' apps/web/app apps/web/components apps/web/lib 2>/dev/null \
  && grep -Rqs 'CircleHelp\|HelpCircle\|QuestionMarkCircle\|?' apps/web/app apps/web/components apps/web/lib 2>/dev/null; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — no TermLabel-style glossary popover affordance found"
  PASS=false
fi

echo "[32.E1] web unit tests pass"
if pnpm --filter @vooster/web test; then
  echo "    ✓ pass"
else
  echo "    ✗ fail"
  PASS=false
fi

echo "[32.E2] web typecheck passes"
if pnpm --filter @vooster/web typecheck; then
  echo "    ✓ pass"
else
  echo "    ✗ fail"
  PASS=false
fi

echo "[32.F1 Gate rigor]"
if bash "$ROOT/scripts/check-gate-rigor.sh" "$ROOT/goals/32-web-viewer-de-jargon.md" >/dev/null 2>&1; then
  echo "    ✓ pass"
else
  echo "    ✗ fail"
  bash "$ROOT/scripts/check-gate-rigor.sh" "$ROOT/goals/32-web-viewer-de-jargon.md" | sed 's/^/      /'
  PASS=false
fi

if [ "$PASS" = true ]; then
  gate_cache_save "$GOAL_NAME" "${GATE_INPUTS[@]}"
  exit 0
else
  exit 1
fi
