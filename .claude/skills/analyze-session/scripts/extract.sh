#!/usr/bin/env bash
# Distill a Claude Code session JSONL into a compact, greppable digest.
# Raw sessions can be many MB. Do not read the JSONL directly into the model.
# Usage: extract.sh <session.jsonl>

set -uo pipefail

F="${1:?usage: extract.sh <session.jsonl>}"
[ -f "$F" ] || {
  echo "No such file: $F" >&2
  exit 1
}

jqc() { jq -r "$1" "$F" 2>/dev/null; }

results() {
  jqc 'select(.type=="user") | .message.content
       | if type=="array" then
           (.[] | select(.type=="tool_result")
                | (if (.content|type)=="array"
                     then (.content[] | select(.type=="text") | .text)
                     else (.content|tostring) end))
         else empty end'
}

commands() {
  jqc 'select(.type=="assistant")|.message.content[]?|select(.type=="tool_use" and .name=="Bash")|.input.command'
}

echo "## Session"
echo "path:  $F"
echo "lines: $(wc -l < "$F" | tr -d ' ')   bytes: $(wc -c < "$F" | tr -d ' ')"
echo "cwd:   $(jqc 'select(.cwd!=null)|.cwd' | sort -u | paste -sd, -)"
echo "branch:$(jqc 'select(.gitBranch!=null)|.gitBranch' | sort -u | paste -sd, -)"
echo

echo "## Human prompts"
jqc 'select(.type=="user") | .message.content
     | if type=="string" then .
       elif type=="array" then (.[]|select(.type=="text")|.text)
       else empty end' | sed 's/^/- /'
echo

echo "## Tool usage counts"
jqc 'select(.type=="assistant")|.message.content[]?|select(.type=="tool_use")|.name' \
  | sort | uniq -c | sort -rn
echo

echo "## vspec commands in order"
commands | grep -nE '(^|[[:space:]])(pnpm |npx )?vspec([[:space:]]|$)' ||
  echo "(no vspec invocations found)"
echo

echo "## vspec subcommand frequency (excludes help/which)"
commands \
  | grep -oE 'vspec(-[a-z]+)? [a-z][a-z-]*( [a-z][a-z-]*)?' \
  | grep -vwE 'help|which' \
  | grep -vE -- '--' \
  | sort | uniq -c | sort -rn || echo "(none)"
echo

echo "## --format usage across vspec calls"
commands | grep -oE -- '--format[= ][a-z]+' | sort | uniq -c ||
  echo "(no explicit --format)"
echo

echo "## Direct edits to synced spec state"
jqc 'select(.type=="assistant")|.message.content[]?|select(.type=="tool_use" and (.name=="Edit" or .name=="MultiEdit" or .name=="Write"))|.input.file_path' \
  | grep -oE '(^|/)(specs/[^ ]*|docs/usecases/[^ ]*|\.vspec/[^ ]*)' \
  | sort | uniq -c || echo "(none)"
echo

RES="$(results)"

echo "## Error codes seen in tool results"
printf '%s\n' "$RES" | grep -oE '"code": *"[A-Za-z_][A-Za-z0-9_]*"' \
  | sort | uniq -c | sort -rn || echo "(none)"
echo

echo "## Error / failure samples"
printf '%s\n' "$RES" \
  | grep -nE '"code"|"title"|"message"|INVALID_|NOT_FOUND|VALIDATION_FAILED|Exit code [1-9]|Error:|error:' \
  | head -80 || echo "(none)"
echo

echo "## suggested_next_actions occurrences in results: $(printf '%s\n' "$RES" | grep -c suggested_next_actions)"
echo

echo "## Assistant narration"
jqc 'select(.type=="assistant")|.message.content[]?|select(.type=="text")|.text' \
  | grep -v '^[[:space:]]*$' | sed 's/^/| /'
