#!/usr/bin/env bash
# check-cli.sh — Goal 1 gate: vspec CLI exists and covers every advertised command.
#
# A CLI command is "advertised" when it appears as a string literal in HTTP
# responses — i.e., any quoted `vspec ...` token in apps/api/src/http/*.ts. The CLI
# must surface a subcommand for each.
#
# Failure modes (in order):
#   - no oclif bin (`apps/cli/bin/run.js` or package.json `bin` entry missing)
#   - `npx vspec --help` does not exit 0
#   - some advertised command has no matching subcommand in `npx vspec <cmd> --help`

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [ ! -f apps/cli/package.json ]; then
  echo "✗ check-cli: apps/cli/package.json missing."
  exit 1
fi

if ! node -e "const p=require('./apps/cli/package.json'); if ((p.bin||{}).vspec !== './bin/run.js') process.exit(1)"; then
  echo "✗ check-cli: apps/cli/package.json has no bin.vspec entry."
  echo "  Add: \"bin\": { \"vspec\": \"./bin/run.js\" }."
  exit 1
fi

if [ ! -x apps/cli/bin/run.js ] && [ ! -f apps/cli/bin/run.js ]; then
  echo "✗ check-cli: apps/cli/bin/run.js missing."
  exit 1
fi

# Run --help via the bin entry — do not rely on a global install.
if ! node apps/cli/bin/run.js --help >/dev/null 2>&1; then
  echo "✗ check-cli: 'node apps/cli/bin/run.js --help' did not exit 0."
  node apps/cli/bin/run.js --help 2>&1 | head -20 | sed 's/^/    /'
  exit 1
fi

# Collect advertised commands from HTTP responses. Pattern matches:
#   - `recommended_next_command: "vspec ..."`
#   - `command: "vspec ..."` inside suggested_next_actions arrays
ADVERTISED=$(grep -rEho '"vspec [^"]+"' apps/api/src/http 2>/dev/null \
  | sed 's/^"vspec //; s/"$//' \
  | awk '{print $1" "$2}' \
  | sort -u)

if [ -z "$ADVERTISED" ]; then
  echo "✗ check-cli: no advertised 'vspec ...' commands found in apps/api/src/http — sanity failed."
  exit 1
fi

_CHECK_CLI_PIDS=()
_CHECK_CLI_CMDS=()
_CHECK_CLI_TMPDIR="$(mktemp -d)"
while IFS= read -r cmd; do
  [ -z "$cmd" ] && continue
  # Strip placeholder args like <slug> or {id}.
  CLEAN=$(echo "$cmd" | awk '{print $1" "$2}' | sed 's/[<{][^>}]*[>}]//g' | xargs)
  TOPIC=$(echo "$CLEAN" | awk '{print $1}')
  SUB=$(echo "$CLEAN" | awk '{print $2}')
  out="$_CHECK_CLI_TMPDIR/$(echo "$CLEAN" | tr ' /' '__')"
  if [ -z "$SUB" ]; then
    node apps/cli/bin/run.js "$TOPIC" --help >"$out" 2>&1 &
    _CHECK_CLI_PIDS+=("$!")
    _CHECK_CLI_CMDS+=("vspec $TOPIC")
  else
    node apps/cli/bin/run.js "$TOPIC" "$SUB" --help >"$out" 2>&1 &
    _CHECK_CLI_PIDS+=("$!")
    _CHECK_CLI_CMDS+=("vspec $TOPIC $SUB")
  fi
done <<< "$ADVERTISED"
MISSING=()
for i in "${!_CHECK_CLI_PIDS[@]}"; do
  if ! wait "${_CHECK_CLI_PIDS[$i]}"; then
    MISSING+=("${_CHECK_CLI_CMDS[$i]}")
  fi
done
rm -rf "$_CHECK_CLI_TMPDIR"

if [ "${#MISSING[@]}" -ne 0 ]; then
  echo "✗ check-cli: the following advertised CLI commands have no oclif subcommand:"
  for m in "${MISSING[@]}"; do echo "    - $m"; done
  echo ""
  echo "  Implement each as an @oclif/core Command that calls the API."
  exit 1
fi

echo "✓ check-cli: vspec --help OK; every advertised command has a subcommand."
exit 0
