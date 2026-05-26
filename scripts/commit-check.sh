#!/usr/bin/env bash
# commit-check.sh — fast staged-impact regression check for pre-commit.
#
# This intentionally does not run scripts/completion-check.sh. Commit-time
# feedback stays small: staged hygiene checks, nearest impacted tests/gates,
# and explicit warnings for broad changes that need the full sweep before push
# or merge.

set -o pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

DRY_RUN="${VSPEC_COMMIT_CHECK_DRY_RUN:-0}"
FAIL=0
BROAD=0

STAGED=()
if [ -n "${VSPEC_COMMIT_CHECK_STAGED_FILES:-}" ]; then
  while IFS= read -r file; do
    [ -n "$file" ] && STAGED+=("$file")
  done <<<"$VSPEC_COMMIT_CHECK_STAGED_FILES"
else
  while IFS= read -r file; do
    [ -n "$file" ] && STAGED+=("$file")
  done < <(git diff --cached --name-only --diff-filter=ACMR)
fi

if [ "${#STAGED[@]}" -eq 0 ]; then
  echo "✓ commit-check: no staged files to check"
  exit 0
fi

check_hook_installation() {
  local hook_path target
  hook_path="$(git rev-parse --git-path hooks/pre-commit 2>/dev/null || true)"
  [ -n "$hook_path" ] || return 0

  if [ ! -e "$hook_path" ]; then
    echo "⚠ pre-commit hook is not installed; run 'pnpm install' (its prepare"
    echo "  script wires hooks) or: git config core.hooksPath scripts/hooks"
    return 0
  fi

  if [ -L "$hook_path" ]; then
    target="$(readlink "$hook_path")"
    case "$target" in
      *scripts/hooks/pre-commit)
        return 0
        ;;
    esac
  elif cmp -s "$hook_path" "$ROOT/scripts/hooks/pre-commit"; then
    return 0
  fi

  echo "⚠ pre-commit hook path does not point at scripts/hooks/pre-commit:"
  echo "  $hook_path"
}

PRETTIER_FILES=()
ESLINT_FILES=()
VITEST_TESTS=()
GOAL_RIGOR_TARGETS=()
GOAL_GATE_TARGETS=()
BROAD_FILES=()
UNKNOWN_FILES=()

check_hook_installation

has_item() {
  local needle="$1"
  shift
  local item
  for item in "$@"; do
    [ "$item" = "$needle" ] && return 0
  done
  return 1
}

append_unique() {
  local value="$1"
  shift
  local array_name="$1"
  eval "has_item \"\$value\" \"\${${array_name}[@]:-}\"" && return 0
  eval "${array_name}+=(\"\$value\")"
}

mark_broad() {
  BROAD=1
  append_unique "$1" BROAD_FILES
}

mark_unknown() {
  BROAD=1
  append_unique "$1" UNKNOWN_FILES
}

is_secret_or_local_config() {
  case "$1" in
    .env|.env.*|*/.env|*/.env.*)
      if [ "$1" = ".env.example" ] || [ "${1##*/}" = ".env.example" ]; then
        return 1
      fi
      return 0
      ;;
    *.pem|*.key|*.p12|*.pfx)
      return 0
      ;;
  esac
  return 1
}

is_generated_artifact() {
  case "$1" in
    node_modules/*|*/node_modules/*|dist/*|*/dist/*|build/*|*/build/*|coverage/*|*/coverage/*|.next/*|*/.next/*|.turbo/*|*/.turbo/*|*.tsbuildinfo)
      return 0
      ;;
  esac
  return 1
}

is_broad_surface() {
  case "$1" in
    package.json|pnpm-lock.yaml|pnpm-workspace.yaml|tsconfig*.json|tsconfig.*.json|eslint.config.js|vitest.config.ts|Dockerfile|docker-compose*.yml|docker-compose*.yaml|.github/workflows/*)
      return 0
      ;;
    apps/api/prisma/schema.prisma|scripts/completion-check.sh|scripts/_gate-cache.sh|scripts/commit-check.sh|scripts/hooks/pre-commit|scripts/hooks/pre-push)
      return 0
      ;;
    apps/api/tests/helpers/*|apps/cli/tests/e2e-cli/helpers.ts|apps/cli/tests/e2e-cli-honest/cli-setup.ts)
      return 0
      ;;
    apps/api/src/index.ts|apps/api/src/http/server.ts|apps/cli/bin/run.js)
      return 0
      ;;
  esac
  return 1
}

maybe_add_hygiene() {
  case "$1" in
    *.ts|*.tsx|*.js|*.jsx|*.json|*.md|*.css|*.yml|*.yaml)
      append_unique "$1" PRETTIER_FILES
      ;;
  esac

  case "$1" in
    *.ts|*.tsx|*.js|*.jsx)
      append_unique "$1" ESLINT_FILES
      ;;
  esac
}

test_if_present() {
  local test_file="$1"
  if [ -f "$test_file" ]; then
    append_unique "$test_file" VITEST_TESTS
    return 0
  fi
  return 1
}

classify_source() {
  local file="$1"
  local base name goal_md

  case "$file" in
    apps/api/tests/*/*.test.ts|apps/api/tests/*/*/*.test.ts|apps/cli/tests/*/*.test.ts|apps/cli/tests/*/*/*.test.ts)
      test_if_present "$file" || mark_unknown "$file"
      return
      ;;
    apps/api/tests/unit/*/*-fixtures.ts|apps/api/tests/unit/*/*-data.ts|apps/api/tests/unit/*/*-helpers.ts)
      base="${file%.ts}"
      base="${base%-fixtures}"
      base="${base%-data}"
      base="${base%-helpers}"
      test_if_present "${base}.test.ts" || mark_unknown "$file"
      return
      ;;
    goals/*.md|goals/*.gates.sh|goals/*.next-task.sh)
      base="${file#goals/}"
      name="${base%.md}"
      name="${name%.gates.sh}"
      name="${name%.next-task.sh}"
      goal_md="goals/${name}.md"
      if [ -f "$goal_md" ]; then
        append_unique "$goal_md" GOAL_RIGOR_TARGETS
        if [ "$file" != "$goal_md" ] && [ -f "goals/${name}.gates.sh" ]; then
          append_unique "goals/${name}.gates.sh" GOAL_GATE_TARGETS
        fi
      else
        mark_unknown "$file"
      fi
      return
      ;;
    apps/api/src/application/*.ts)
      base="$(basename "$file" .ts)"
      test_if_present "apps/api/tests/unit/application/${base}.test.ts" || mark_unknown "$file"
      return
      ;;
    apps/api/src/domain/entities/*.ts|apps/api/src/domain/*.ts)
      test_if_present "apps/api/tests/unit/domain-entities.test.ts" || mark_unknown "$file"
      return
      ;;
    apps/api/src/http/*.ts)
      base="$(basename "$file" .ts)"
      test_if_present "apps/api/tests/unit/http/${base}.test.ts" || mark_unknown "$file"
      return
      ;;
    apps/cli/src/commands/*.ts)
      base="$(basename "$file" .ts)"
      test_if_present "apps/cli/tests/unit/${base}-command.test.ts" || mark_unknown "$file"
      return
      ;;
    apps/web/*|apps/web/**/*)
      mark_unknown "$file"
      return
      ;;
    .env.example|docs/*.md|docs/**/*.md|README.md|README.ko.md|AGENTS.md|.agents/skills/commit/SKILL.md)
      return
      ;;
    scripts/*.sh|scripts/*.mjs|scripts/*.ts)
      mark_unknown "$file"
      return
      ;;
    *)
      mark_unknown "$file"
      return
      ;;
  esac
}

run_cmd() {
  if [ "$DRY_RUN" = "1" ]; then
    echo "$*"
    return 0
  fi

  echo "▷ $*"
  "$@"
}

run_shell() {
  if [ "$DRY_RUN" = "1" ]; then
    echo "$*"
    return 0
  fi

  echo "▷ $*"
  eval "$*"
}

for file in "${STAGED[@]}"; do
  if is_secret_or_local_config "$file"; then
    echo "✗ commit-check: staged secret/local config file: $file"
    FAIL=1
    continue
  fi

  if is_generated_artifact "$file"; then
    echo "✗ commit-check: staged generated artifact: $file"
    FAIL=1
    continue
  fi

  maybe_add_hygiene "$file"

  if is_broad_surface "$file"; then
    mark_broad "$file"
    continue
  fi

  classify_source "$file"
done

if [ "$FAIL" -ne 0 ]; then
  echo
  echo "✗ commit blocked: remove unsafe staged files and retry."
  exit 1
fi

if [ "${#PRETTIER_FILES[@]}" -gt 0 ]; then
  run_cmd pnpm exec prettier --check --ignore-unknown "${PRETTIER_FILES[@]}" || FAIL=1
fi

if [ "${#ESLINT_FILES[@]}" -gt 0 ]; then
  run_cmd pnpm exec eslint --max-warnings 0 --no-warn-ignored "${ESLINT_FILES[@]}" || FAIL=1
fi

if [ "${#VITEST_TESTS[@]}" -gt 0 ]; then
  run_cmd pnpm exec vitest run "${VITEST_TESTS[@]}" || FAIL=1
fi

for goal_md in "${GOAL_RIGOR_TARGETS[@]}"; do
  run_cmd bash scripts/check-gate-rigor.sh "$goal_md" || FAIL=1
done

for goal_gate in "${GOAL_GATE_TARGETS[@]}"; do
  run_shell "VSPEC_GATES_SKIP_DEEP=1 bash $goal_gate" || FAIL=1
done

if [ "$BROAD" -eq 1 ]; then
  echo
  echo "⚠ full regression required before push/merge:"
  echo "  bash scripts/completion-check.sh"
  if [ "${#BROAD_FILES[@]}" -gt 0 ]; then
    echo "  Broad staged files:"
    printf '    - %s\n' "${BROAD_FILES[@]}"
  fi
  if [ "${#UNKNOWN_FILES[@]}" -gt 0 ]; then
    echo "  Unknown staged impact:"
    printf '    - %s\n' "${UNKNOWN_FILES[@]}"
  fi
fi

if [ "$FAIL" -ne 0 ]; then
  echo
  echo "✗ commit blocked: staged impact checks failed."
  exit 1
fi

echo "✓ commit-check: staged impact checks passed"
