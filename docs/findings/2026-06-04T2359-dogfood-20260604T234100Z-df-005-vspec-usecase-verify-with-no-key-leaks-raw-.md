---
title: `vspec usecase verify` with no key leaks raw `ApiError: 404` instead of a self-teaching envelope
created_at: 2026-06-04T23:59:45Z
resolved: true
priority: P1
source: dogfood-loop cycle 20260604T234100Z
related:
  - docs/dogfood-loop.md
---

# `vspec usecase verify` with no key leaks raw `ApiError: 404` instead of a self-teaching envelope

**TL;DR.** CLI fix: validate that `usecase verify` has a use case key before calling the API and emit a self-teaching error (stable `code`, message naming the missing argument, and `suggested_next_actions` such as `vspec usecase list` / verify a specific key). If a keyless 'verify all' is intended, implement it; otherwise translate the upstream 404 into the documented envelope rather than printing the internal `ApiError` class. Routing codex (TDD).

Surfaced by the dogfood loop (cycle `20260604T234100Z`). QUANTS: ANS.
Root-cause area: `apps/cli/src (usecase verify command — missing required-arg validation) and apps/api/src/http (verify route returns a bare 404 that the CLI surfaces as a raw ApiError instead of the documented Problem Details envelope)`. Routing: codex.

## Evidence

Command 8 `vspec usecase verify --format=json 2>&1` produced digest lines 63-64 / session lines 174-175: `Exit code 1` then `ApiError: API request failed with 404.` with no `code`, no `details`, and no `suggested_next_actions`. The agent recovered only by guessing to add an explicit key — command 9 `vspec usecase verify POCKET-001 --format=json` then returned `status: pass`.

## Recommendation

CLI fix: validate that `usecase verify` has a use case key before calling the API and emit a self-teaching error (stable `code`, message naming the missing argument, and `suggested_next_actions` such as `vspec usecase list` / verify a specific key). If a keyless 'verify all' is intended, implement it; otherwise translate the upstream 404 into the documented envelope rather than printing the internal `ApiError` class. Routing codex (TDD).

## Acceptance signal

Re-running the dogfood case that produced this finding no longer
reports it at P0/P1 severity.
