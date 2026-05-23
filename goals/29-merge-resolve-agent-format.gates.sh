#!/usr/bin/env bash
# goals/29-merge-resolve-agent-format.gates.sh — Gate suite for goal 29.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=../scripts/_gate-cache.sh
source "$ROOT/scripts/_gate-cache.sh"

GOAL_NAME="29-merge-resolve-agent-format"

GATE_INPUTS=(
  apps/cli/src/commands/merge.ts
  apps/cli/src/commands/merge-output.ts
  apps/cli/tests/unit
  apps/cli/tests/e2e-cli
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
MERGE_CMD=apps/cli/src/commands/merge.ts
MERGE_OUTPUT=apps/cli/src/commands/merge-output.ts
UNIT_TEST=apps/cli/tests/unit/merge-resolve-agent-format.test.ts
E2E_TEST=apps/cli/tests/e2e-cli/merge-resolve-agent-format.test.ts
HONEST_TEST=apps/cli/tests/e2e-cli-honest/merge-resolve-agent-format.test.ts
OLD_MERGE_BULLET='`merge resolve`'
SETUP_BULLET='`merge resolve public conflict setup`'
LOCK_RELEASE_BULLET='`lock release`'

extract_function() {
  local file="$1"
  local fn="$2"
  awk -v fn="$fn" '
    $0 ~ "^(export )?(async )?function " fn "\\(" { capture=1 }
    capture && $0 ~ "^(export )?(async )?function " && $0 !~ "^(export )?(async )?function " fn "\\(" { exit }
    capture { print }
  ' "$file"
}

echo "[29.A1 merge resolve findings split]"
if grep -F -- "- $OLD_MERGE_BULLET" "$FINDINGS" >/dev/null 2>&1; then
  echo "    ✗ fail — exact merge resolve agent-format debt remains"
  PASS=false
elif ! grep -F "$LOCK_RELEASE_BULLET" "$FINDINGS" >/dev/null 2>&1; then
  echo "    ✗ fail — lock release debt was removed"
  PASS=false
elif ! grep -F "$SETUP_BULLET" "$FINDINGS" >/dev/null 2>&1; then
  echo "    ✗ fail — merge resolve public setup debt is missing"
  PASS=false
else
  echo "    ✓ pass"
fi

echo "[29.A2 prior merge sentinels retargeted]"
A2_OFFENDERS=()
while IFS= read -r file; do
  case "$file" in
    goals/29-merge-resolve-agent-format.gates.sh|goals/29-merge-resolve-agent-format.next-task.sh)
      continue
      ;;
  esac
  if grep -F -- "- $OLD_MERGE_BULLET" "$file" >/dev/null 2>&1 ||
     grep -F "MERGE_BULLET='$OLD_MERGE_BULLET'" "$file" >/dev/null 2>&1; then
    A2_OFFENDERS+=("$file still contains old merge resolve sentinel")
  fi
done < <(grep -lF "$OLD_MERGE_BULLET" goals/*.gates.sh goals/*.next-task.sh 2>/dev/null)
if [ "${#A2_OFFENDERS[@]}" -eq 0 ]; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — prior sentinel retarget gaps:"
  printf '        %s\n' "${A2_OFFENDERS[@]}"
  PASS=false
fi

echo "[29.B1 docs/07-cli-spec.md documents merge resolve agent format]"
B1_OFFENDERS=()
if grep -F "merge resolve --format=agent" "$CLI_SPEC" | grep -F "remains queued" >/dev/null 2>&1; then
  B1_OFFENDERS+=("old queued merge resolve sentence still present")
fi
for token in \
  "### Agent Format - Merge Resolve" \
  "vspec merge resolve <id> --format=agent" \
  "data.merge_request" \
  "data.new_revisions" \
  "data.source_branch" \
  "context.branch" \
  "context.revision" \
  "suggested_next_actions"; do
  if ! grep -F -- "$token" "$CLI_SPEC" >/dev/null 2>&1; then
    B1_OFFENDERS+=("$token")
  fi
done
if [ "${#B1_OFFENDERS[@]}" -eq 0 ]; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — missing merge resolve spec text:"
  printf '        %s\n' "${B1_OFFENDERS[@]}"
  PASS=false
fi

echo "[29.C1 resolveMerge builds an agent envelope]"
RESOLVE_BLOCK=$(extract_function "$MERGE_CMD" "resolveMerge")
if [ -n "$RESOLVE_BLOCK" ] &&
   printf '%s\n' "$RESOLVE_BLOCK" | grep -F 'format === "agent"' >/dev/null 2>&1 &&
   printf '%s\n' "$RESOLVE_BLOCK" | grep -F "buildAgentEnvelope" >/dev/null 2>&1 &&
   printf '%s\n' "$RESOLVE_BLOCK" | grep -F "data: body" >/dev/null 2>&1 &&
   printf '%s\n' "$RESOLVE_BLOCK" | grep -F "suggested_next_actions: body.suggested_next_actions" >/dev/null 2>&1 &&
   printf '%s\n' "$RESOLVE_BLOCK" | grep -F "revision: body.new_revisions.at(0)?.id ?? null" >/dev/null 2>&1 &&
   printf '%s\n' "$RESOLVE_BLOCK" | grep -F "branch: body.source_branch.name" >/dev/null 2>&1; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — resolveMerge missing agent envelope mapping"
  PASS=false
fi

echo "[29.C2 merge resolve response exposes revision ids]"
if grep -F "new_revisions: Array<{" "$MERGE_OUTPUT" >/dev/null 2>&1 &&
   grep -F "id: string" "$MERGE_OUTPUT" >/dev/null 2>&1; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — MergeResolveResponse.new_revisions is not typed with revision_id"
  PASS=false
fi

echo "[29.C3 production merge command has no test setup route]"
if grep -F "__test" "$MERGE_CMD" >/dev/null 2>&1; then
  echo "    ✗ fail — merge command contains __test"
  PASS=false
else
  echo "    ✓ pass"
fi

echo "[29.D1 unit tests prove merge resolve agent envelope]"
D1_OFFENDERS=()
if [ ! -f "$UNIT_TEST" ]; then
  D1_OFFENDERS+=("$UNIT_TEST missing")
else
  for token in \
    "agent merge resolve" \
    "agent merge resolve without new revision" \
    "human merge resolve output" \
    "JSON.parse(stdout)" \
    "format_version" \
    "data.merge_request.id" \
    "data.new_revisions" \
    "data.source_branch" \
    "context.branch" \
    "context.revision" \
    "suggested_next_actions" \
    "warnings"; do
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

echo "[29.E1 CLI E2E proves merge resolve agent envelope]"
E1_OFFENDERS=()
if [ ! -f "$E2E_TEST" ]; then
  E1_OFFENDERS+=("$E2E_TEST missing")
else
  for token in \
    "agent merge resolve" \
    "runCli(" \
    '"merge"' \
    '"resolve"' \
    "--format=agent" \
    "JSON.parse" \
    "format_version" \
    "data.merge_request.id" \
    "data.new_revisions" \
    "data.source_branch" \
    "context.branch" \
    "context.revision" \
    "suggested_next_actions"; do
    if ! grep -F -- "$token" "$E2E_TEST" >/dev/null 2>&1; then
      E1_OFFENDERS+=("$E2E_TEST missing $token")
    fi
  done
fi
if [ "${#E1_OFFENDERS[@]}" -eq 0 ]; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — CLI E2E proof gaps:"
  printf '        %s\n' "${E1_OFFENDERS[@]}"
  PASS=false
fi

echo "[29.E2 proof does not pretend to be honest public setup]"
E2_OFFENDERS=()
if [ -f "$HONEST_TEST" ]; then
  E2_OFFENDERS+=("$HONEST_TEST must not exist")
fi
if [ -f "$E2E_TEST" ]; then
  if grep -E 'fetch\([^)]*/v1/merges/[^)]*/resolve' "$E2E_TEST" >/dev/null 2>&1; then
    E2_OFFENDERS+=("$E2E_TEST fetches merge resolve API directly")
  fi
  if grep -E '\bfetch\(' "$E2E_TEST" >/dev/null 2>&1 &&
     ! grep -F "/__test/" "$E2E_TEST" >/dev/null 2>&1; then
    E2_OFFENDERS+=("$E2E_TEST fetch setup does not show __test use")
  fi
fi
if awk 'index($0, "HONEST_UC_SET=(") { capture=1; next } capture && /^\)/ { capture=0 } capture { print }' \
    goals/7-cli-spec-parity.gates.sh | grep -E 'merge-resolve-agent|Goal 29' >/dev/null 2>&1; then
  E2_OFFENDERS+=("HONEST_UC_SET was widened for Goal 29")
fi
if [ "${#E2_OFFENDERS[@]}" -eq 0 ]; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — honest-boundary gaps:"
  printf '        %s\n' "${E2_OFFENDERS[@]}"
  PASS=false
fi

echo "[29.F1 Gate rigor]"
if "$ROOT/scripts/check-gate-rigor.sh" "$ROOT/goals/29-merge-resolve-agent-format.md" >/dev/null 2>&1; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — re-run: bash scripts/check-gate-rigor.sh goals/29-merge-resolve-agent-format.md"
  PASS=false
fi

if [ "$PASS" = true ]; then
  gate_cache_save "$GOAL_NAME" "${GATE_INPUTS[@]}"
  exit 0
fi

exit 1
