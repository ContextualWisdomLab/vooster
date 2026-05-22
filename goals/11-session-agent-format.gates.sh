#!/usr/bin/env bash
# goals/11-session-agent-format.gates.sh — Gate suite for goal 11.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=../scripts/_gate-cache.sh
source "$ROOT/scripts/_gate-cache.sh"

GOAL_NAME="11-session-agent-format"

GATE_INPUTS=(
  apps/cli/src/agent-envelope.ts
  apps/cli/src/commands/session.ts
  apps/cli/src/commands/session-flags.ts
  apps/cli/src/commands/session-output.ts
  apps/cli/src/index.ts
  apps/cli/tests/unit
  apps/cli/tests/e2e-cli-honest
  docs/07-cli-spec.md
  docs/findings/2026-05-21T1856-cli-spec-gaps.md
  goals/7-cli-spec-parity.gates.sh
  scripts/check-gate-rigor.sh
  goals/11-session-agent-format.gates.sh
  goals/11-session-agent-format.md
  scripts/_gate-cache.sh
)

if gate_cache_hit "$GOAL_NAME" "${GATE_INPUTS[@]}"; then
  echo "[cache hit] goal $GOAL_NAME inputs unchanged"
  exit 0
fi

PASS=true

CLI_SPEC=docs/07-cli-spec.md
FINDINGS=docs/findings/2026-05-21T1856-cli-spec-gaps.md
CLI_INDEX=apps/cli/src/index.ts
SESSION_CMD=apps/cli/src/commands/session.ts
UNIT_TEST=apps/cli/tests/unit/session-agent-format.test.ts
HONEST_TEST=apps/cli/tests/e2e-cli-honest/session-agent-format.test.ts

SESSION_AGENT_SITES=(
  "session start|startSession"
  "session list|listSessions"
  "session complete|completeSession"
)

extract_function() {
  local file="$1"
  local fn="$2"
  awk -v fn="$fn" '
    $0 ~ "^(async )?function " fn "\\(" { capture=1 }
    capture && $0 ~ "^(async )?function " && $0 !~ "^(async )?function " fn "\\(" { exit }
    capture { print }
  ' "$file"
}

echo "[11.A1 session agent debt removed from findings]"
A1_LINES=$(awk '
  /^## `--format=agent` coverage debt/ { capture=1; next }
  capture && /^## / { capture=0 }
  capture && /^-/ { print }
' "$FINDINGS")
if printf '%s\n' "$A1_LINES" | grep -F "session start" >/dev/null 2>&1 ||
   printf '%s\n' "$A1_LINES" | grep -F "session complete" >/dev/null 2>&1 ||
   printf '%s\n' "$A1_LINES" | grep -F "session list" >/dev/null 2>&1; then
  echo "    ✗ fail — session agent debt still appears in $FINDINGS"
  PASS=false
elif ! printf '%s\n' "$A1_LINES" | grep -F "lock" >/dev/null 2>&1; then
  echo "    ✗ fail — unrelated agent debt was removed from $FINDINGS"
  PASS=false
else
  echo "    ✓ pass"
fi

echo "[11.B1 docs/07-cli-spec.md documents session agent format]"
B1_OFFENDERS=()
for token in \
  "### Agent Format for Sessions" \
  "vspec session start --format=agent" \
  "vspec session list --format=agent" \
  "vspec session complete <id> --format=agent" \
  "context.session_id" \
  "default null context"; do
  if ! grep -F -- "$token" "$CLI_SPEC" >/dev/null 2>&1; then
    B1_OFFENDERS+=("$token")
  fi
done
if [ "${#B1_OFFENDERS[@]}" -eq 0 ]; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — missing session agent spec text:"
  printf '        %s\n' "${B1_OFFENDERS[@]}"
  PASS=false
fi

echo "[11.C1 session.ts discovered by Goal 7 agent-branch source]"
if grep -rlE 'format === "agent"' apps/cli/src/commands 2>/dev/null |
   grep -Fx "$SESSION_CMD" >/dev/null 2>&1; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — $SESSION_CMD is not in grep -rl 'format === \"agent\"' set"
  PASS=false
fi

echo "[11.C2 every session handler builds an agent envelope]"
C2_OFFENDERS=()
for site in "${SESSION_AGENT_SITES[@]}"; do
  IFS='|' read -r verb fn <<<"$site"
  block=$(extract_function "$SESSION_CMD" "$fn")
  if [ -z "$block" ]; then
    C2_OFFENDERS+=("$verb missing $fn")
    continue
  fi
  if ! printf '%s\n' "$block" | grep -F 'format === "agent"' >/dev/null 2>&1; then
    C2_OFFENDERS+=("$verb missing format === \"agent\" in $fn")
    continue
  fi
  if ! printf '%s\n' "$block" | grep -F "buildAgentEnvelope" >/dev/null 2>&1; then
    C2_OFFENDERS+=("$verb missing buildAgentEnvelope in $fn")
  fi
done
if [ "${#C2_OFFENDERS[@]}" -eq 0 ]; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — handler-level envelope gaps:"
  printf '        %s\n' "${C2_OFFENDERS[@]}"
  PASS=false
fi

echo "[11.C3 dispatcher routes exactly implemented session verbs]"
DISPATCHED_SESSION_ACTIONS=$(grep -oE 'parsed\.args\.command === "session" && this\.argv\[1\] === "[^"]+"' "$CLI_INDEX" |
  sed -E 's/.*=== "([^"]+)"/\1/' |
  sort |
  tr '\n' ' ' |
  sed 's/ $//')
if [ "$DISPATCHED_SESSION_ACTIONS" = "complete list start" ]; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — session dispatcher actions = '$DISPATCHED_SESSION_ACTIONS' (expected 'complete list start')"
  PASS=false
fi

echo "[11.D1 unit tests prove session agent envelopes]"
D1_OFFENDERS=()
if [ ! -f "$UNIT_TEST" ]; then
  D1_OFFENDERS+=("$UNIT_TEST missing")
else
  for site in "${SESSION_AGENT_SITES[@]}"; do
    verb=${site%%|*}
    action=${verb#session }
    for token in "agent $verb" "\"$action\"" "--format=agent"; do
      if ! grep -F -- "$token" "$UNIT_TEST" >/dev/null 2>&1; then
        D1_OFFENDERS+=("$verb missing unit token $token")
      fi
    done
  done
  for token in \
    "format_version" \
    "context.session_id" \
    "started_at" \
    "project_id" \
    "session_file" \
    "total_conflicts" \
    "ended_at" \
    "released_lock_ids"; do
    if ! grep -F -- "$token" "$UNIT_TEST" >/dev/null 2>&1; then
      D1_OFFENDERS+=("$UNIT_TEST missing $token assertion")
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

echo "[11.D2 unit tests keep human session renderer smoke coverage]"
D2_OFFENDERS=()
if [ ! -f "$UNIT_TEST" ]; then
  D2_OFFENDERS+=("$UNIT_TEST missing")
else
  for site in "${SESSION_AGENT_SITES[@]}"; do
    verb=${site%%|*}
    if ! grep -F -- "human $verb" "$UNIT_TEST" >/dev/null 2>&1; then
      D2_OFFENDERS+=("$verb missing human smoke test")
    fi
  done
fi
if [ "${#D2_OFFENDERS[@]}" -eq 0 ]; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — human smoke proof gaps:"
  printf '        %s\n' "${D2_OFFENDERS[@]}"
  PASS=false
fi

echo "[11.E1 honest E2E proves session agent envelopes]"
E1_OFFENDERS=()
if [ ! -f "$HONEST_TEST" ]; then
  E1_OFFENDERS+=("$HONEST_TEST missing")
else
  if grep -E '\bfetch\(' "$HONEST_TEST" >/dev/null 2>&1; then
    E1_OFFENDERS+=("$HONEST_TEST calls fetch(")
  fi
  for token in "VSPEC_CONFIG_PATH" "runCli([" "--format=agent" "format_version" "context.session_id" "total_conflicts"; do
    if ! grep -F -- "$token" "$HONEST_TEST" >/dev/null 2>&1; then
      E1_OFFENDERS+=("$HONEST_TEST missing $token")
    fi
  done
  for site in "${SESSION_AGENT_SITES[@]}"; do
    verb=${site%%|*}
    action=${verb#session }
    if ! grep -F -- "agent $verb" "$HONEST_TEST" >/dev/null 2>&1; then
      E1_OFFENDERS+=("$verb missing honest test title")
    fi
    if ! grep -F -- '"session"' "$HONEST_TEST" >/dev/null 2>&1 ||
       ! grep -F -- "\"$action\"" "$HONEST_TEST" >/dev/null 2>&1; then
      E1_OFFENDERS+=("$verb missing runCli tokens")
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

echo "[11.E2 honest proof does not widen Goal 7 UC set]"
if [ -f "$HONEST_TEST" ] &&
   basename "$HONEST_TEST" | grep -E '^UC-' >/dev/null 2>&1; then
  echo "    ✗ fail — session agent proof must be verb-level, not UC-prefixed"
  PASS=false
elif awk 'index($0, "HONEST_UC_SET=(") { capture=1; next } capture && /^\)/ { capture=0 } capture { print }' \
    goals/7-cli-spec-parity.gates.sh | grep -E 'session|agent-format|Goal 11' >/dev/null 2>&1; then
  echo "    ✗ fail — HONEST_UC_SET was widened for Goal 11"
  PASS=false
else
  echo "    ✓ pass"
fi

echo "[11.F1 Gate rigor]"
if "$ROOT/scripts/check-gate-rigor.sh" "$ROOT/goals/11-session-agent-format.md" >/dev/null 2>&1; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — re-run: bash scripts/check-gate-rigor.sh goals/11-session-agent-format.md"
  PASS=false
fi

if [ "$PASS" = true ]; then
  gate_cache_save "$GOAL_NAME" "${GATE_INPUTS[@]}"
  exit 0
fi

exit 1
