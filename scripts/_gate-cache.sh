# scripts/_gate-cache.sh — Source-only helper for goal gate memoization.
#
# Each goal's <n>-<name>.gates.sh wraps its work with two calls:
#
#   source "$ROOT/scripts/_gate-cache.sh"
#
#   if gate_cache_hit "<goal-name>"; then
#     echo "[cache hit] goal <goal-name> passed at $(gate_cache_sha "<goal-name>")"
#     exit 0
#   fi
#
#   # ... run gates ...
#
#   if [ "$PASS" = true ]; then
#     gate_cache_save "<goal-name>"
#     exit 0
#   fi
#
# Cache key: current HEAD sha AND a clean working tree (no modified or
# untracked files). Any uncommitted change invalidates every cache.
#
# Manual override:
#   rm -rf .state/gate-cache              # bust all caches
#   rm    .state/gate-cache/<goal-name>   # bust one
#
# Env override:
#   VSPEC_GATES_NO_CACHE=1                # bypass cache for this invocation

_gate_cache_dir() {
  local root
  root="${GATE_CACHE_ROOT:-${ROOT:-$(pwd)}}"
  echo "$root/.state/gate-cache"
}

_gate_cache_clean_tree() {
  # 0 if working tree has no modified or untracked files.
  local out
  out=$(git status --porcelain 2>/dev/null) || return 1
  [ -z "$out" ]
}

gate_cache_sha() {
  local goal_name="$1"
  local cache_file
  cache_file="$(_gate_cache_dir)/$goal_name"
  [ -f "$cache_file" ] && cat "$cache_file"
}

gate_cache_hit() {
  local goal_name="$1"
  [ "${VSPEC_GATES_NO_CACHE:-}" = "1" ] && return 1

  local cache_file
  cache_file="$(_gate_cache_dir)/$goal_name"
  [ -f "$cache_file" ] || return 1

  _gate_cache_clean_tree || return 1

  local cached current
  cached=$(cat "$cache_file")
  current=$(git rev-parse HEAD 2>/dev/null) || return 1
  [ "$cached" = "$current" ]
}

gate_cache_save() {
  local goal_name="$1"
  local dir current
  dir="$(_gate_cache_dir)"
  current=$(git rev-parse HEAD 2>/dev/null) || return 0
  _gate_cache_clean_tree || return 0
  mkdir -p "$dir"
  printf '%s\n' "$current" > "$dir/$goal_name"
}
