#!/usr/bin/env bash
set -euo pipefail

DOCS_DIR="${1:-docs/usecases}"
if [ "$#" -gt 0 ]; then
  shift
fi
ALLOWED=" $* "

while IFS= read -r uc; do
  case "$ALLOWED" in
    *" $uc "*) ;;
    *) printf '%s\n' "$uc" ;;
  esac
done < <(
  find "$DOCS_DIR" -name 'UC-*.md' -type f 2>/dev/null \
    | sed -E 's#.*/(UC-[0-9]+).*#\1#' \
    | sort
)
