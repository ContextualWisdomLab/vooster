#!/usr/bin/env bash
# goals/27-push-agent-format.gates.sh — Gate suite for goal 27.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=../scripts/_gate-cache.sh
source "$ROOT/scripts/_gate-cache.sh"

GOAL_NAME="27-push-agent-format"

GATE_INPUTS=(
  apps/cli/src/agent-envelope.ts
  apps/cli/src/commands/push.ts
  apps/cli/src/commands/sync.ts
  apps/cli/tests/unit
  apps/cli/tests/e2e-cli-honest
  docs/07-cli-spec.md
  docs/findings-cli-spec-gaps.md
  goals
  scripts/check-gate-rigor.sh
  scripts/_gate-cache.sh
)

if gate_cache_hit "$GOAL_NAME" "${GATE_INPUTS[@]}"; then
  echo "[cache hit] goal $GOAL_NAME inputs unchanged"
  exit 0
fi

PASS=true

FINDINGS=docs/findings-cli-spec-gaps.md
CLI_SPEC=docs/07-cli-spec.md
SYNC_CMD=apps/cli/src/commands/sync.ts
PUSH_CMD=apps/cli/src/commands/push.ts
UNIT_TEST=apps/cli/tests/unit/push-agent-format.test.ts
HONEST_TEST=apps/cli/tests/e2e-cli-honest/push-agent-format.test.ts
OLD_PUSH_BULLET='`push`'
LOCK_BULLET='`lock release`'
MERGE_SETUP_BULLET='`merge resolve public conflict setup`'

extract_function() {
  local file="$1"
  local fn="$2"
  awk -v fn="$fn" '
    $0 ~ "^(export )?(async )?function " fn "\\(" { capture=1 }
    capture && $0 ~ "^(export )?(async )?function " && $0 !~ "^(export )?(async )?function " fn "\\(" { exit }
    capture { print }
  ' "$file"
}

echo "[27.A1 push findings removed]"
if grep -F "$OLD_PUSH_BULLET" "$FINDINGS" >/dev/null 2>&1; then
  echo "    ✗ fail — push debt remains"
  PASS=false
elif ! grep -F "$LOCK_BULLET" "$FINDINGS" >/dev/null 2>&1; then
  echo "    ✗ fail — lock release/renew debt was removed"
  PASS=false
elif ! grep -F "$MERGE_SETUP_BULLET" "$FINDINGS" >/dev/null 2>&1; then
  echo "    ✗ fail — merge resolve public setup debt was removed"
  PASS=false
else
  echo "    ✓ pass"
fi

echo "[27.A2 prior push sentinels retargeted]"
A2_OFFENDERS=()
while IFS= read -r file; do
  case "$file" in
    goals/27-push-agent-format.gates.sh|goals/27-push-agent-format.next-task.sh)
      continue
      ;;
  esac
  A2_OFFENDERS+=("$file still contains old push sentinel")
done < <(grep -lF "$OLD_PUSH_BULLET" goals/*.gates.sh goals/*.next-task.sh 2>/dev/null)
if [ "${#A2_OFFENDERS[@]}" -eq 0 ]; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — prior sentinel retarget gaps:"
  printf '        %s\n' "${A2_OFFENDERS[@]}"
  PASS=false
fi

echo "[27.B1 docs/07-cli-spec.md documents push agent format]"
B1_OFFENDERS=()
for token in \
  "### Agent Format - Push" \
  "vspec push --format=agent" \
  "default null" \
  "data.results" \
  "data.cache.entries" \
  "data.suggested_next_actions" \
  "applies returned revisions before the envelope" \
  "suggested_next_actions" \
  "warnings"; do
  if ! grep -F -- "$token" "$CLI_SPEC" >/dev/null 2>&1; then
    B1_OFFENDERS+=("$token")
  fi
done
if [ "${#B1_OFFENDERS[@]}" -eq 0 ]; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — missing push agent spec text:"
  printf '        %s\n' "${B1_OFFENDERS[@]}"
  PASS=false
fi

echo "[27.C1 push exposes format flag]"
if grep -F "format?: string" "$PUSH_CMD" >/dev/null 2>&1 &&
   grep -F "format: Flags.string()" "$PUSH_CMD" >/dev/null 2>&1; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — push missing format flag"
  PASS=false
fi

echo "[27.C2 pushFiles builds an agent envelope]"
PUSH_BLOCK=$(extract_function "$SYNC_CMD" "pushFiles")
if [ -n "$PUSH_BLOCK" ] &&
   printf '%s\n' "$PUSH_BLOCK" | grep -F 'format === "agent"' >/dev/null 2>&1 &&
   printf '%s\n' "$PUSH_BLOCK" | grep -F "buildAgentEnvelope" >/dev/null 2>&1 &&
   printf '%s\n' "$PUSH_BLOCK" | grep -F "suggested_next_actions: body.suggested_next_actions" >/dev/null 2>&1; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — pushFiles missing agent envelope"
  PASS=false
fi

echo "[27.C3 push applies sync results before agent output]"
if [ -n "$PUSH_BLOCK" ] &&
   printf '%s\n' "$PUSH_BLOCK" | awk '
     /applySyncResults/ { applied=NR }
     /format === "agent"/ { agent=NR }
     END { exit !(applied > 0 && agent > applied) }
   '; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — push agent output occurs before sync results are applied"
  PASS=false
fi

echo "[27.C4 pull/sync routing stays scoped]"
PULL_BLOCK=$(extract_function "$SYNC_CMD" "pullFiles")
RUN_SYNC_BLOCK=$(extract_function "$SYNC_CMD" "runSync")
if printf '%s\n' "$PULL_BLOCK" | grep -F "writeSyncFile" >/dev/null 2>&1 &&
   printf '%s\n' "$PULL_BLOCK" | awk '
     /writeSyncFile/ { wrote=NR }
     /format === "agent"/ { agent=NR }
     END { exit !(wrote > 0 && agent > wrote) }
   ' &&
   printf '%s\n' "$RUN_SYNC_BLOCK" | grep -F 'action === "push"' >/dev/null 2>&1 &&
   printf '%s\n' "$RUN_SYNC_BLOCK" | grep -F "await pullFiles(flags, writeLine)" >/dev/null 2>&1; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — pull/sync routing changed unexpectedly"
  PASS=false
fi

echo "[27.D1 unit tests prove push agent envelope]"
D1_OFFENDERS=()
if [ ! -f "$UNIT_TEST" ]; then
  D1_OFFENDERS+=("$UNIT_TEST missing")
else
  for token in \
    "agent push" \
    "agent push applies revisions before output" \
    "agent dry-run leaves files unchanged" \
    "human push output" \
    "--format=agent" \
    "format_version" \
    "data.results" \
    "data.cache.entries" \
    "data.suggested_next_actions" \
    "context).toEqual" \
    "project_key: null" \
    "branch: null" \
    "session_id: null" \
    "revision: null" \
    "suggested_next_actions" \
    "warnings" \
    "JSON.parse(stdout)"; do
    if ! grep -F -- "$token" "$UNIT_TEST" >/dev/null 2>&1; then
      D1_OFFENDERS+=("$UNIT_TEST missing $token")
    fi
  done
fi
if [ "${#D1_OFFENDERS[@]}" -eq 0 ]; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — unit proof gaps:"
  printf '        %s\n' "${D1_OFFENDERS[@]}"
  PASS=false
fi

echo "[27.E1 honest E2E proves push agent lifecycle]"
E1_OFFENDERS=()
if [ ! -f "$HONEST_TEST" ]; then
  E1_OFFENDERS+=("$HONEST_TEST missing")
else
  if grep -E '\bfetch\(' "$HONEST_TEST" >/dev/null 2>&1; then
    E1_OFFENDERS+=("$HONEST_TEST calls fetch(")
  fi
  for token in \
    "agent push writes canonical file revisions" \
    "runCli([" \
    '"push"' \
    "--format=agent" \
    "VSPEC_CONFIG_PATH" \
    "format_version" \
    "data.results" \
    "data.cache.entries" \
    "data.suggested_next_actions" \
    "context).toEqual" \
    "project_key: null" \
    "branch: null" \
    "session_id: null" \
    "revision: null"; do
    if ! grep -F -- "$token" "$HONEST_TEST" >/dev/null 2>&1; then
      E1_OFFENDERS+=("$HONEST_TEST missing $token")
    fi
  done
fi
if [ "${#E1_OFFENDERS[@]}" -eq 0 ]; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — honest E2E proof gaps:"
  printf '        %s\n' "${E1_OFFENDERS[@]}"
  PASS=false
fi

echo "[27.E2 honest proof does not widen Goal 7 UC set]"
if [ -f "$HONEST_TEST" ] &&
   basename "$HONEST_TEST" | grep -E '^UC-' >/dev/null 2>&1; then
  echo "    ✗ fail — push agent proof must be verb-level, not UC-prefixed"
  PASS=false
elif awk 'index($0, "HONEST_UC_SET=(") { capture=1; next } capture && /^\)/ { capture=0 } capture { print }' \
    goals/7-cli-spec-parity.gates.sh | grep -E 'push-agent|Goal 27' >/dev/null 2>&1; then
  echo "    ✗ fail — HONEST_UC_SET was widened for Goal 27"
  PASS=false
else
  echo "    ✓ pass"
fi

echo "[27.F1 Gate rigor]"
if "$ROOT/scripts/check-gate-rigor.sh" "$ROOT/goals/27-push-agent-format.md" >/dev/null 2>&1; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — re-run: bash scripts/check-gate-rigor.sh goals/27-push-agent-format.md"
  PASS=false
fi

if [ "$PASS" = true ]; then
  gate_cache_save "$GOAL_NAME" "${GATE_INPUTS[@]}"
  exit 0
fi

exit 1
