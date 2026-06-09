#!/usr/bin/env bash
set -uo pipefail
cat <<'TASK'
TASK: Resolve the dogfood finding "Use-case `level` is effectively immutable: `usecase set` 404s and `change propose` silently drops it".

1. Read docs/findings/2026-06-04T2116-dogfood-20260604T204814Z-df-004-use-case-level-is-effectively-immutable-use.md.
2. Add a failing test that captures the finding's user-visible failure: changing a use case's `level` (SUMMARY/USER_GOAL/SUBFUNCTION) is impossible — `usecase set --field level` 404s and `change propose` with a `level` patch produces a `.data.diff` that omits `level` (only `title` appears) and never persists the new level.
3. Implement the smallest fix in the stated root-cause area: make `level` a first-class mutable field — either expose a working `usecase set --field level` route OR have `change propose` accept, diff, and persist `level` in its patch `fields`. A supplied `level` must appear in `.data.diff` and be persisted; an unknown/unsupported field must be rejected with a self-teaching error (stable code, human message, suggested_next_actions) rather than silently dropped or a raw 404.
4. Run the targeted test and the relevant gate.
5. Update docs/findings/2026-06-04T2116-dogfood-20260604T204814Z-df-004-use-case-level-is-effectively-immutable-use.md with verification evidence and set resolved: true.
TASK
