#!/usr/bin/env bash
# check-ci.sh — verify the CI *system* exercises the Postgres-backed suite and
# the goal gate sweep, by PARSING workflow YAML (not grepping comments).
#
# Per-file (universal):  every workflow file is valid YAML.
# System-level (exists): some workflow runs the test suite in a job that
#                        declares a Postgres service; some workflow runs
#                        completion-check.sh. These are existential because
#                        workflows specialise (a lint-only / deploy / fast-test
#                        workflow need not do either) — goal 3 (managed-db)
#                        cares about CI as a whole, not about each file.
#
# The checks read jobs[].services and jobs[].steps[].run from the parsed
# document, so a comment can never satisfy them. The built-in self-test proves
# exactly that: a workflow that mentions postgres/completion-check only in a
# comment, or that declares a Postgres service it never uses, is rejected.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# Workflow files to inspect: an explicit override (used by the self-test) or
# every file under .github/workflows.
if [ -n "${VSPEC_CHECK_CI_FILES:-}" ]; then
  # shellcheck disable=SC2206
  FILES=(${VSPEC_CHECK_CI_FILES})
else
  FILES=()
  while IFS= read -r f; do
    FILES+=("$f")
  done < <(find .github/workflows -maxdepth 1 -type f \( -name '*.yml' -o -name '*.yaml' \) 2>/dev/null | sort)
fi

if [ "${#FILES[@]}" -eq 0 ]; then
  echo "✗ check-ci: no workflow files found"
  exit 1
fi

ruby - "${FILES[@]}" <<'RUBY'
require "yaml"

test_re  = /vitest\s+run|pnpm\s+exec\s+vitest|pnpm(\s+\S+)*\s+test\b|pnpm\s+run\s+test|npm\s+(run\s+)?test/
sweep_re = /completion-check\.sh|world-check\.sh/
pg_re    = %r{(\A|/)postgres(\z|[:/])}

parse_ok = true
has_pg_suite = false
has_sweep = false
shards_ok = true

ARGV.each do |path|
  begin
    doc = YAML.load_file(path)
  rescue => e
    warn "✗ check-ci: #{path} is not parseable YAML (#{e.message})"
    parse_ok = false
    next
  end
  next unless doc.is_a?(Hash)
  jobs = doc["jobs"]
  next unless jobs.is_a?(Hash)

  jobs.each_value do |job|
    next unless job.is_a?(Hash)
    services = job["services"].is_a?(Hash) ? job["services"] : {}
    steps    = job["steps"].is_a?(Array) ? job["steps"] : []
    runs     = steps.map { |s| s.is_a?(Hash) ? s["run"].to_s : "" }

    job_has_pg    = services.values.any? { |s| s.is_a?(Hash) && s["image"].to_s =~ pg_re }
    job_runs_test = runs.any? { |r| r =~ test_re }
    shard_matrix  = job.dig("strategy", "matrix", "shard")

    if shard_matrix.is_a?(Array)
      if File.basename(path) == "ci.yml" && shard_matrix.length > 2
        warn "✗ check-ci: #{path} test shard matrix has #{shard_matrix.length} shards; expected at most 2"
        shards_ok = false
      end

      has_shard_argument = false
      runs.each do |run|
        next unless run =~ /--shard=\$\{\{\s*matrix\.shard\s*\}\}\/(\d+)/

        has_shard_argument = true
        denominator = Regexp.last_match(1).to_i
        next if denominator == shard_matrix.length

        warn "✗ check-ci: #{path} shard denominator /#{denominator} does not match matrix size #{shard_matrix.length}"
        shards_ok = false
      end

      if job_runs_test && !has_shard_argument
        warn "✗ check-ci: #{path} test job declares matrix.shard but no --shard=${{ matrix.shard }}/N argument"
        shards_ok = false
      end
    end

    has_pg_suite ||= (job_has_pg && job_runs_test)
    has_sweep    ||= runs.any? { |r| r =~ sweep_re }
  end
end

ok = parse_ok
ok &&= shards_ok
unless has_pg_suite
  warn "✗ check-ci: no workflow runs the test suite in a job with a Postgres service"
  ok = false
end
unless has_sweep
  warn "✗ check-ci: no workflow runs completion-check.sh (the goal gate sweep)"
  ok = false
end
exit(ok ? 0 : 1)
RUBY
if [ $? -ne 0 ]; then
  exit 1
fi

# ── Self-test: the structural checks must be un-gameable by comments or by a
#    declared-but-unused Postgres service. Re-invokes this script against
#    throwaway fixtures (recursion guarded by VSPEC_CHECK_CI_SKIP_SELF_TEST).
if [ -z "${VSPEC_CHECK_CI_SKIP_SELF_TEST:-}" ]; then
  d="$(mktemp -d)"
  trap 'rm -rf "$d"' EXIT

  cat >"$d/pass.yml" <<'YML'
name: pass
on: [push]
jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
    steps:
      - run: pnpm exec vitest run
      - run: bash scripts/completion-check.sh
YML

  cat >"$d/bad-shards.yml" <<'YML'
name: bad-shards
on: [push]
jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        shard: [1, 2]
    services:
      postgres:
        image: postgres:16-alpine
    steps:
      - run: pnpm exec vitest run --shard=${{ matrix.shard }}/4
      - run: bash scripts/completion-check.sh
YML

  cat >"$d/missing-shard-argument.yml" <<'YML'
name: missing-shard-argument
on: [push]
jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        shard: [1, 2]
    services:
      postgres:
        image: postgres:16-alpine
    steps:
      - run: pnpm exec vitest run
      - run: bash scripts/completion-check.sh
YML

  cat >"$d/comment-only.yml" <<'YML'
# postgres + completion-check.sh appear only in this comment, never executed
name: comment-only
on: [push]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: echo build
YML

  cat >"$d/pg-unused.yml" <<'YML'
name: pg-unused
on: [push]
jobs:
  idle:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
    steps:
      - run: echo no tests here
YML

  if VSPEC_CHECK_CI_SKIP_SELF_TEST=1 VSPEC_CHECK_CI_FILES="$d/pass.yml $d/comment-only.yml" bash "$0" >/dev/null 2>&1 \
    && ! VSPEC_CHECK_CI_SKIP_SELF_TEST=1 VSPEC_CHECK_CI_FILES="$d/comment-only.yml" bash "$0" >/dev/null 2>&1 \
    && ! VSPEC_CHECK_CI_SKIP_SELF_TEST=1 VSPEC_CHECK_CI_FILES="$d/pg-unused.yml" bash "$0" >/dev/null 2>&1 \
    && ! VSPEC_CHECK_CI_SKIP_SELF_TEST=1 VSPEC_CHECK_CI_FILES="$d/bad-shards.yml" bash "$0" >/dev/null 2>&1 \
    && ! VSPEC_CHECK_CI_SKIP_SELF_TEST=1 VSPEC_CHECK_CI_FILES="$d/missing-shard-argument.yml" bash "$0" >/dev/null 2>&1; then
    :
  else
    echo "✗ check-ci self-test: structural checks are gameable"
    exit 1
  fi
fi

echo "✓ check-ci: every workflow parses; a job runs the suite against Postgres; some workflow runs completion-check.sh (self-test passed)"
