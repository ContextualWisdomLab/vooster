#!/usr/bin/env bash
# goals/26-pull-sync-agent-format.gates.sh — Gate suite for goal 26.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=../scripts/_gate-cache.sh
source "$ROOT/scripts/_gate-cache.sh"

GOAL_NAME="26-pull-sync-agent-format"

GATE_INPUTS=(
  apps/cli/src/agent-envelope.ts
  apps/cli/src/commands/pull.ts
  apps/cli/src/commands/push.ts
  apps/cli/src/commands/sync.ts
  apps/cli/tests/unit
  apps/cli/tests/e2e-cli-honest
  docs/07-cli-spec.md
  docs/findings/2026-05-21T1856-cli-spec-gaps.md
  goals
  scripts/check-gate-rigor.sh
  scripts/_gate-cache.sh
)

if gate_cache_hit "$GOAL_NAME" "${GATE_INPUTS[@]}"; then
  echo "[cache hit] goal $GOAL_NAME inputs unchanged"
  exit 0
fi

PASS=true

FINDINGS=docs/findings/2026-05-21T1856-cli-spec-gaps.md
CLI_SPEC=docs/07-cli-spec.md
SYNC_CMD=apps/cli/src/commands/sync.ts
PULL_CMD=apps/cli/src/commands/pull.ts
PUSH_CMD=apps/cli/src/commands/push.ts
UNIT_TEST=apps/cli/tests/unit/pull-sync-agent-format.test.ts
HONEST_TEST=apps/cli/tests/e2e-cli-honest/pull-sync-agent-format.test.ts
OLD_SYNC_BULLET='`pull`, `pu''sh`, `sync`'
PUSH_BULLET='`lock release`'

extract_function() {
  local file="$1"
  local fn="$2"
  awk -v fn="$fn" '
    $0 ~ "^(export )?(async )?function " fn "\\(" { capture=1 }
    capture && $0 ~ "^(export )?(async )?function " && $0 !~ "^(export )?(async )?function " fn "\\(" { exit }
    capture { print }
  ' "$file"
}

echo "[26.A1 pull/sync findings narrowed]"
if grep -F "$OLD_SYNC_BULLET" "$FINDINGS" >/dev/null 2>&1; then
  echo "    ✗ fail — pull/push/sync debt remains grouped"
  PASS=false
elif ! grep -F "$PUSH_BULLET" "$FINDINGS" >/dev/null 2>&1; then
  echo "    ✗ fail — push debt was removed"
  PASS=false
else
  echo "    ✓ pass"
fi

echo "[26.A2 prior sentinels retargeted]"
A2_OFFENDERS=()
while IFS= read -r file; do
  case "$file" in
    goals/26-pull-sync-agent-format.gates.sh|goals/26-pull-sync-agent-format.next-task.sh)
      continue
      ;;
  esac
  A2_OFFENDERS+=("$file still contains old pull/push/sync sentinel")
done < <(grep -lF "$OLD_SYNC_BULLET" goals/*.gates.sh goals/*.next-task.sh 2>/dev/null)
if [ "${#A2_OFFENDERS[@]}" -eq 0 ]; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — prior sentinel retarget gaps:"
  printf '        %s\n' "${A2_OFFENDERS[@]}"
  PASS=false
fi

echo "[26.B1 docs/07-cli-spec.md documents pull/sync agent format]"
B1_OFFENDERS=()
for token in \
  "### Agent Format — Pull and Sync" \
  "vspec pull --format=agent" \
  "vspec sync --format=agent" \
  "default null" \
  "data.cursor" \
  "data.files" \
  "files are written before the envelope" \
  "suggested_next_actions"; do
  if ! grep -F -- "$token" "$CLI_SPEC" >/dev/null 2>&1; then
    B1_OFFENDERS+=("$token")
  fi
done
if [ "${#B1_OFFENDERS[@]}" -eq 0 ]; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — missing pull/sync agent spec text:"
  printf '        %s\n' "${B1_OFFENDERS[@]}"
  PASS=false
fi

echo "[26.C1 sync.ts discovered by Goal 7 agent-branch source]"
if grep -rlE 'format === "agent"' apps/cli/src/commands 2>/dev/null |
   grep -Fx "$SYNC_CMD" >/dev/null 2>&1; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — $SYNC_CMD is not in grep -rl 'format === \"agent\"' set"
  PASS=false
fi

echo "[26.C2 pullFiles builds an agent envelope]"
PULL_BLOCK=$(extract_function "$SYNC_CMD" "pullFiles")
if [ -n "$PULL_BLOCK" ] &&
   printf '%s\n' "$PULL_BLOCK" | grep -F 'format === "agent"' >/dev/null 2>&1 &&
   printf '%s\n' "$PULL_BLOCK" | grep -F "buildAgentEnvelope" >/dev/null 2>&1; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — pullFiles missing agent envelope"
  PASS=false
fi

echo "[26.C3 pull/sync expose format flag]"
if grep -F "format?: string" "$SYNC_CMD" >/dev/null 2>&1 &&
   grep -F "format: Flags.string()" "$SYNC_CMD" >/dev/null 2>&1 &&
   grep -F "format?: string" "$PULL_CMD" >/dev/null 2>&1 &&
   grep -F "format: Flags.string()" "$PULL_CMD" >/dev/null 2>&1; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — pull/sync missing format flag"
  PASS=false
fi

echo "[26.C4 push remains queued]"
PUSH_BLOCK=$(extract_function "$SYNC_CMD" "pushFiles")
if grep -F "Supersedes:" goals/27-push-agent-format.md >/dev/null 2>&1 &&
   grep -F "Goal 26's C4 gate" goals/27-push-agent-format.md >/dev/null 2>&1 &&
   grep -F "format: Flags.string()" "$PUSH_CMD" >/dev/null 2>&1 &&
   printf '%s\n' "$PUSH_BLOCK" | grep -F "buildAgentEnvelope" >/dev/null 2>&1; then
  echo "    ✓ pass (superseded by Goal 27)"
elif ! grep -F "format: Flags.string()" "$PUSH_CMD" >/dev/null 2>&1 &&
   ! printf '%s\n' "$PUSH_BLOCK" | grep -F "buildAgentEnvelope" >/dev/null 2>&1; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — push gained agent-format behavior in Goal 26"
  PASS=false
fi

echo "[26.D1 unit tests prove pull/sync agent envelopes]"
D1_OFFENDERS=()
if [ ! -f "$UNIT_TEST" ]; then
  D1_OFFENDERS+=("$UNIT_TEST missing")
else
  for token in \
    "agent pull" \
    "agent sync uses pull behavior" \
    "human pull output" \
    "--format=agent" \
    "format_version" \
    "data.cursor" \
    "data.files" \
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

echo "[26.E1 honest E2E proves pull/sync agent lifecycle]"
E1_OFFENDERS=()
if [ ! -f "$HONEST_TEST" ]; then
  E1_OFFENDERS+=("$HONEST_TEST missing")
else
  if grep -E '\bfetch\(' "$HONEST_TEST" >/dev/null 2>&1; then
    E1_OFFENDERS+=("$HONEST_TEST calls fetch(")
  fi
  for token in \
    "agent pull and sync write canonical files" \
    "runCli([" \
    '"pull"' \
    '"sync"' \
    "--format=agent" \
    "VSPEC_CONFIG_PATH" \
    "format_version" \
    "data.cursor" \
    "data.files" \
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

echo "[26.E2 honest proof does not widen Goal 7 UC set]"
if [ -f "$HONEST_TEST" ] &&
   basename "$HONEST_TEST" | grep -E '^UC-' >/dev/null 2>&1; then
  echo "    ✗ fail — pull/sync agent proof must be verb-level, not UC-prefixed"
  PASS=false
elif awk 'index($0, "HONEST_UC_SET=(") { capture=1; next } capture && /^\)/ { capture=0 } capture { print }' \
    goals/7-cli-spec-parity.gates.sh | grep -E 'pull-sync-agent|Goal 26' >/dev/null 2>&1; then
  echo "    ✗ fail — HONEST_UC_SET was widened for Goal 26"
  PASS=false
else
  echo "    ✓ pass"
fi

echo "[26.F1 Gate rigor]"
if "$ROOT/scripts/check-gate-rigor.sh" "$ROOT/goals/26-pull-sync-agent-format.md" >/dev/null 2>&1; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — re-run: bash scripts/check-gate-rigor.sh goals/26-pull-sync-agent-format.md"
  PASS=false
fi

if [ "$PASS" = true ]; then
  gate_cache_save "$GOAL_NAME" "${GATE_INPUTS[@]}"
  exit 0
fi

exit 1
