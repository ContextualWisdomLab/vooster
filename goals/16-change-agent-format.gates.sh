#!/usr/bin/env bash
# goals/16-change-agent-format.gates.sh — Gate suite for goal 16.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=../scripts/_gate-cache.sh
source "$ROOT/scripts/_gate-cache.sh"

GOAL_NAME="16-change-agent-format"

GATE_INPUTS=(
  apps/cli/src/agent-envelope.ts
  apps/cli/src/commands/change.ts
  apps/cli/src/commands/change-output.ts
  apps/cli/tests/unit
  apps/cli/tests/e2e-cli-honest
  docs/07-cli-spec.md
  docs/findings/2026-05-21T1856-cli-spec-gaps.md
  goals/7-cli-spec-parity.gates.sh
  scripts/check-gate-rigor.sh
  goals/16-change-agent-format.gates.sh
  goals/16-change-agent-format.md
  scripts/_gate-cache.sh
)

if gate_cache_hit "$GOAL_NAME" "${GATE_INPUTS[@]}"; then
  echo "[cache hit] goal $GOAL_NAME inputs unchanged"
  exit 0
fi

PASS=true

FINDINGS=docs/findings/2026-05-21T1856-cli-spec-gaps.md
CLI_SPEC=docs/07-cli-spec.md
CHANGE_CMD=apps/cli/src/commands/change.ts
UNIT_TEST=apps/cli/tests/unit/change-agent-format.test.ts
HONEST_TEST=apps/cli/tests/e2e-cli-honest/change-agent-format.test.ts

extract_function() {
  local file="$1"
  local fn="$2"
  awk -v fn="$fn" '
    $0 ~ "^(async )?function " fn "\\(" { capture=1 }
    capture && $0 ~ "^(async )?function " && $0 !~ "^(async )?function " fn "\\(" { exit }
    capture { print }
  ' "$file"
}

echo "[16.A1 change findings narrowed]"
if grep -F '`change propose` / `change commit`' "$FINDINGS" >/dev/null 2>&1; then
  echo "    ✗ fail — old change propose/commit debt remains"
  PASS=false
elif ! grep -F '`lock release`' "$FINDINGS" >/dev/null 2>&1; then
  echo "    ✗ fail — unimplemented lock release/renew debt was removed"
  PASS=false
elif ! grep -F '`lock release`' "$FINDINGS" >/dev/null 2>&1; then
  echo "    ✗ fail — unrelated pull/push/sync debt was removed"
  PASS=false
else
  echo "    ✓ pass"
fi

echo "[16.B1 docs/07-cli-spec.md documents change agent format]"
B1_OFFENDERS=()
for token in \
  "### Agent Format — Changes" \
  "vspec change propose --format=agent" \
  "vspec change commit --format=agent" \
  "suggested_next_actions" \
  "change propose" \
  "context.revision" \
  "change commit" \
  "data.revisions[0].revision_id"; do
  if ! grep -F -- "$token" "$CLI_SPEC" >/dev/null 2>&1; then
    B1_OFFENDERS+=("$token")
  fi
done
if [ "${#B1_OFFENDERS[@]}" -eq 0 ]; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — missing change agent spec text:"
  printf '        %s\n' "${B1_OFFENDERS[@]}"
  PASS=false
fi

echo "[16.C1 change.ts discovered by Goal 7 agent-branch source]"
if grep -rlE 'format === "agent"' apps/cli/src/commands 2>/dev/null |
   grep -Fx "$CHANGE_CMD" >/dev/null 2>&1; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — $CHANGE_CMD is not in grep -rl 'format === \"agent\"' set"
  PASS=false
fi

echo "[16.C2 proposeChange/commitChange build agent envelopes]"
C2_OFFENDERS=()
for fn in proposeChange commitChange; do
  block=$(extract_function "$CHANGE_CMD" "$fn")
  if [ -z "$block" ] ||
     ! printf '%s\n' "$block" | grep -F 'format === "agent"' >/dev/null 2>&1 ||
     ! printf '%s\n' "$block" | grep -F "buildAgentEnvelope" >/dev/null 2>&1; then
    C2_OFFENDERS+=("$fn")
  fi
done
if [ "${#C2_OFFENDERS[@]}" -eq 0 ]; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — missing handler-level agent envelopes:"
  printf '        %s\n' "${C2_OFFENDERS[@]}"
  PASS=false
fi

echo "[16.C3 change.ts routes only propose/commit actions]"
CHANGE_ACTIONS=$(grep -oE 'action === "[a-z]+"' "$CHANGE_CMD" | sed -E 's/.*"([^"]+)"/\1/' | sort | tr '\n' ' ' | sed 's/ $//')
if [ "$CHANGE_ACTIONS" = "commit propose" ]; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — change actions = '$CHANGE_ACTIONS' (expected 'commit propose')"
  PASS=false
fi

echo "[16.C4 change agent envelopes preserve guidance/context]"
PROPOSE_BLOCK=$(extract_function "$CHANGE_CMD" "proposeChange")
COMMIT_BLOCK=$(extract_function "$CHANGE_CMD" "commitChange")
C4_OFFENDERS=()
if ! printf '%s\n' "$PROPOSE_BLOCK" | grep -F "suggested_next_actions: body.suggested_next_actions" >/dev/null 2>&1; then
  C4_OFFENDERS+=("propose suggested_next_actions")
fi
if ! printf '%s\n' "$PROPOSE_BLOCK" | grep -F "warnings: body.warnings" >/dev/null 2>&1; then
  C4_OFFENDERS+=("propose warnings")
fi
if ! printf '%s\n' "$COMMIT_BLOCK" | grep -F "suggested_next_actions: body.suggested_next_actions" >/dev/null 2>&1; then
  C4_OFFENDERS+=("commit suggested_next_actions")
fi
if ! printf '%s\n' "$COMMIT_BLOCK" | grep -F "revision: body.revisions[0]?.revision_id ?? null" >/dev/null 2>&1; then
  C4_OFFENDERS+=("commit context.revision")
fi
if [ "${#C4_OFFENDERS[@]}" -eq 0 ]; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — missing guidance/context mapping:"
  printf '        %s\n' "${C4_OFFENDERS[@]}"
  PASS=false
fi

echo "[16.D1 unit tests prove change agent envelopes]"
D1_OFFENDERS=()
if [ ! -f "$UNIT_TEST" ]; then
  D1_OFFENDERS+=("$UNIT_TEST missing")
else
  for token in \
    "agent change propose" \
    "agent change commit" \
    "agent change commit without revisions" \
    "human change propose" \
    "human change commit" \
    "--format=agent" \
    "format_version" \
    "data.preview_id" \
    "firstRevision.revision_id" \
    "firstRevision.entity_id" \
    "context.revision" \
    "suggested_next_actions" \
    "warnings" \
    "not.toContain(\"Preview \")" \
    "not.toContain(\"Entity \")" \
    "mkdtempSync"; do
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

echo "[16.E1 honest E2E proves change agent envelopes]"
E1_OFFENDERS=()
if [ ! -f "$HONEST_TEST" ]; then
  E1_OFFENDERS+=("$HONEST_TEST missing")
else
  if grep -E '\bfetch\(' "$HONEST_TEST" >/dev/null 2>&1; then
    E1_OFFENDERS+=("$HONEST_TEST calls fetch(")
  fi
  for token in \
    "agent change propose and commit" \
    "runCli(" \
    '"change"' \
    "--format=agent" \
    "VSPEC_CONFIG_PATH" \
    "usecase" \
    "show" \
    "context.revision" \
    "data.title" \
    "format_version" \
    "data.preview_id" \
    "firstRevision.revision_id"; do
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

echo "[16.E2 honest proof does not widen Goal 7 UC set]"
if [ -f "$HONEST_TEST" ] &&
   basename "$HONEST_TEST" | grep -E '^UC-' >/dev/null 2>&1; then
  echo "    ✗ fail — change agent proof must be verb-level, not UC-prefixed"
  PASS=false
elif awk 'index($0, "HONEST_UC_SET=(") { capture=1; next } capture && /^\)/ { capture=0 } capture { print }' \
    goals/7-cli-spec-parity.gates.sh | grep -E 'change-agent|Goal 16' >/dev/null 2>&1; then
  echo "    ✗ fail — HONEST_UC_SET was widened for Goal 16"
  PASS=false
else
  echo "    ✓ pass"
fi

echo "[16.F1 Gate rigor]"
if "$ROOT/scripts/check-gate-rigor.sh" "$ROOT/goals/16-change-agent-format.md" >/dev/null 2>&1; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — re-run: bash scripts/check-gate-rigor.sh goals/16-change-agent-format.md"
  PASS=false
fi

if [ "$PASS" = true ]; then
  gate_cache_save "$GOAL_NAME" "${GATE_INPUTS[@]}"
  exit 0
fi

exit 1
