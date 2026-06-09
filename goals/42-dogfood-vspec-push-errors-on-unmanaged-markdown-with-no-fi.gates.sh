#!/usr/bin/env bash
# goals/42-dogfood-vspec-push-errors-on-unmanaged-markdown-with-no-fi.gates.sh
# `vspec push` must skip unmanaged markdown under specs/ and raise typed,
# coded, file-named sync-file errors -- never a bare Error string.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=../scripts/_gate-cache.sh
source "$ROOT/scripts/_gate-cache.sh"

GOAL_NAME="42-dogfood-vspec-push-errors-on-unmanaged-markdown-with-no-fi"
GATE_INPUTS=(
  apps/cli/src
  apps/cli/src/commands/sync-files.ts
  apps/cli/src/commands/sync.ts
  apps/cli/src/commands/push.ts
  apps/cli/tests/unit/sync-files-classification.test.ts
  apps/cli/tests/unit/push-agent-format.test.ts
  docs/findings/2026-06-04T1811-dogfood-20260604T180511Z-df-001-vspec-push-errors-on-unmanaged-markdown-wit.md
  goals/42-dogfood-vspec-push-errors-on-unmanaged-markdown-with-no-fi.md
  goals/42-dogfood-vspec-push-errors-on-unmanaged-markdown-with-no-fi.gates.sh
  scripts/check-gate-rigor.sh
  scripts/_gate-cache.sh
)

if gate_cache_hit "$GOAL_NAME" "${GATE_INPUTS[@]}"; then
  echo "[cache hit] goal $GOAL_NAME inputs unchanged"
  exit 0
fi

PASS=true

echo "[42.A1] CLI typecheck (typed sync-file error wiring resolves)"
if pnpm --filter @vooster/cli typecheck; then
  echo "    pass"
else
  echo "    fail"
  PASS=false
fi

echo "[42.A2] push classification behavior suites pass (skip unmanaged, coded error, managed still pushes)"
if pnpm exec vitest run \
  apps/cli/tests/unit/sync-files-classification.test.ts \
  apps/cli/tests/unit/push-agent-format.test.ts; then
  echo "    pass"
else
  echo "    fail"
  PASS=false
fi

echo "[42.B1] no bare un-coded sync-file throw in any apps/cli/src file"
# Negative universal invariant: a behavior test only exercises the paths it
# runs, so it cannot prove the bare throw was removed everywhere. Enumerate the
# source files (source of truth: find) and loop -- none may reintroduce the
# un-coded `new Error("Sync file is missing revision ...` throw.
# (while-read, not mapfile -- system bash is 3.2 and lacks readarray.)
BARE_RE='new Error\(["'\''`]Sync file is missing revision'
OFFENDERS=0
while IFS= read -r src; do
  [ -z "$src" ] && continue
  if grep -Eq "$BARE_RE" "$src"; then
    echo "    fail -- $src still throws a bare un-coded sync-file Error"
    grep -En "$BARE_RE" "$src" | sed 's/^/      /'
    OFFENDERS=$((OFFENDERS + 1))
  fi
done < <(find apps/cli/src -name '*.ts' -type f | sort)

if [ "$OFFENDERS" -eq 0 ]; then
  echo "    pass -- every apps/cli/src file routes sync-file rejections through the typed error"
else
  PASS=false
fi

echo "[42.C1 Gate rigor]"
if bash "$ROOT/scripts/check-gate-rigor.sh" "$ROOT/goals/$GOAL_NAME.md" >/dev/null 2>&1; then
  echo "    pass"
else
  echo "    fail"
  bash "$ROOT/scripts/check-gate-rigor.sh" "$ROOT/goals/$GOAL_NAME.md" | sed 's/^/      /'
  PASS=false
fi

if [ "$PASS" = true ]; then
  gate_cache_save "$GOAL_NAME" "${GATE_INPUTS[@]}"
  exit 0
else
  exit 1
fi
