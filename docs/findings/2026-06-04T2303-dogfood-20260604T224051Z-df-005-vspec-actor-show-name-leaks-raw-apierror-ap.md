---
title: `vspec actor show <name>` leaks raw `ApiError: API request failed with 404.` instead of a self-teaching envelope
created_at: 2026-06-04T23:03:54Z
resolved: true
priority: P1
source: dogfood-loop cycle 20260604T224051Z
related:
  - docs/dogfood-loop.md
---

# `vspec actor show <name>` leaks raw `ApiError: API request failed with 404.` instead of a self-teaching envelope

**TL;DR.** API/CLI fix: have `actor show` accept the display name (matching how `actor list`/ai-guide present actors), or, when a 404 occurs, translate it into the documented Problem Details envelope with a stable `code`, a message naming the lookup key, and `suggested_next_actions` pointing at the matching id from `actor list`. Never let a raw `ApiError: ...` class string reach stdout/stderr.

Surfaced by the dogfood loop (cycle `20260604T224051Z`). QUANTS: ANS.
Root-cause area: `apps/cli/src (actor show command + error handling) and apps/api/src/http (actor show endpoint; Problem Details envelope per docs/06-api-contract.md)`. Routing: codex.

## Evidence

Command 15/16: `vspec actor show "Account Holder"` (and "Pocket"/"Partner") after `vspec actor list` had returned names+types+IDs (digest lines 1210-1212: `Account Holder PRIMARY f9210548-...`). Output (session lines 1216-1220): `=== Account Holder ===`/`=== Pocket ===`/`=== Partner ===` then `Exit code 1` and `ApiError: API request failed with 404.`. The CLI surfaced the bare internal error-class string with no stable `code`, no message explaining that show resolves by id (not display name), and no `suggested_next_actions` (e.g. retry with the listed id). The agent abandoned per-actor inspection and fell back to `actor list`.

## Recommendation

API/CLI fix: have `actor show` accept the display name (matching how `actor list`/ai-guide present actors), or, when a 404 occurs, translate it into the documented Problem Details envelope with a stable `code`, a message naming the lookup key, and `suggested_next_actions` pointing at the matching id from `actor list`. Never let a raw `ApiError: ...` class string reach stdout/stderr.

## Acceptance signal

Re-running the dogfood case that produced this finding no longer
reports it at P0/P1 severity.
