#!/usr/bin/env bash
# goals/45-dogfood-passive-voice-step-linter-false-positives-on-activ.gates.sh
# vspec must never recommend step wording its own passive-voice linter rejects.
# Enumerates every recommended step-action example from vspec's own docs and runs
# the REAL shared detector over each; also locks the Korean exemption via tests.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=../scripts/_gate-cache.sh
source "$ROOT/scripts/_gate-cache.sh"

GOAL_NAME="45-dogfood-passive-voice-step-linter-false-positives-on-activ"
GATE_INPUTS=(
  apps/api/src/application/passive-voice.ts
  apps/api/src/application/ai-guide.ts
  apps/cli/src/cli-help.ts
  apps/api/tests/unit/application/passive-voice.test.ts
  goals/45-dogfood-passive-voice-step-linter-false-positives-on-activ.md
  goals/45-dogfood-passive-voice-step-linter-false-positives-on-activ.gates.sh
  scripts/check-gate-rigor.sh
  scripts/_gate-cache.sh
)

if gate_cache_hit "$GOAL_NAME" "${GATE_INPUTS[@]}"; then
  echo "[cache hit] goal $GOAL_NAME inputs unchanged"
  exit 0
fi

PASS=true

echo "[45.A1] API typecheck"
if pnpm --filter @vooster/api typecheck; then
  echo "    pass"
else
  echo "    fail"
  PASS=false
fi

echo "[45.A2] passive-voice behavior suite passes (Korean exemption + over-correction lock)"
if pnpm exec vitest run apps/api/tests/unit/application/passive-voice.test.ts; then
  echo "    pass"
else
  echo "    fail"
  PASS=false
fi

echo "[45.B1] every recommended step-action example passes the real passive-voice linter"
# Source of truth: the --action "<text>" examples vspec recommends in its own docs.
DOC_FILES=(
  apps/api/src/application/ai-guide.ts
  apps/cli/src/cli-help.ts
)
# A temp dir keeps the probe file named *.ts (BSD mktemp would mangle a .ts suffix).
PROBE_DIR="$(mktemp -d -t vspec45.XXXXXX)"
EXAMPLES_FILE="$PROBE_DIR/examples.txt"
trap 'rm -rf "$PROBE_DIR"' EXIT

# Enumerate (dedup) the recommended step-action wordings.
grep -hoE -- '--action "[^"]+"' "${DOC_FILES[@]}" \
  | sed -E 's/^--action "//; s/"$//' \
  | sort -u > "$EXAMPLES_FILE"

# Empty-enumeration cheat guard: count must be non-zero, and echo each example.
EXAMPLE_COUNT=0
while IFS= read -r ex; do
  [ -z "$ex" ] && continue
  EXAMPLE_COUNT=$((EXAMPLE_COUNT + 1))
  echo "      example: $ex"
done < "$EXAMPLES_FILE"

if [ "$EXAMPLE_COUNT" -lt 1 ]; then
  echo "    fail -- enumerated 0 recommended step-action examples from docs (source of truth empty)"
  PASS=false
else
  echo "    enumerated $EXAMPLE_COUNT recommended example(s); running the real detector over each"
  # Run the REAL shared usesPassiveVoice over every enumerated example, plus a
  # Hangul smoke for the Korean exemption. tsx resolves the .ts source via .js.
  PROBE_FILE="$PROBE_DIR/probe.ts"
  # Unquoted heredoc so $ROOT is interpolated into a static import path (a static
  # import avoids the top-level-await CJS-transform error tsx hits in a temp dir).
  cat > "$PROBE_FILE" <<TS
import { readFileSync } from "node:fs";
import { usesPassiveVoice } from "$ROOT/apps/api/src/application/passive-voice.js";

const examples = readFileSync(process.env.EXAMPLES_FILE as string, "utf8")
  .split(/\r?\n/)
  .map((s) => s.trim())
  .filter((s) => s.length > 0);

let bad = 0;
for (const ex of examples) {
  if (usesPassiveVoice(ex)) {
    console.error("    REJECTED recommended example: " + JSON.stringify(ex));
    bad++;
  }
}

// Korean exemption: Hangul step actions must not be linted by English-only rules.
const koreanActive = "사용자가 금액을 입력하고 카테고리를 선택한다";
if (usesPassiveVoice(koreanActive)) {
  console.error("    REJECTED Korean active step: " + JSON.stringify(koreanActive));
  bad++;
}

if (bad > 0) {
  console.error("    " + bad + " self-inconsistency(ies) — vspec recommends wording its linter rejects");
  process.exit(1);
}
process.exit(0);
TS
  if EXAMPLES_FILE="$EXAMPLES_FILE" \
      node_modules/.bin/tsx "$PROBE_FILE"; then
    echo "    pass -- every recommended example (and Korean smoke) is accepted"
  else
    echo "    fail -- the linter rejects wording vspec itself recommends"
    PASS=false
  fi
fi

echo "[45.C1 Gate rigor]"
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
