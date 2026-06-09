---
title: `TITLE_NOT_VERB_PHRASE` rejects valid actor-prefixed use-case titles, forcing `--force`
created_at: 2026-06-04T21:16:57Z
resolved: false
priority: P2
source: dogfood-loop cycle 20260604T204814Z
related:
  - docs/dogfood-loop.md
---

# `TITLE_NOT_VERB_PHRASE` rejects valid actor-prefixed use-case titles, forcing `--force`

**TL;DR.** Soften the verb-phrase check to accept '<Actor> <verb> <object>' forms (or downgrade to a warning rather than a hard rejection). Since the product is Korean-first, ensure the heuristic is not English-only; an over-strict English title rule is a correctness risk for non-English specs.

Surfaced by the dogfood loop (cycle `20260604T204814Z`). QUANTS: NS.
Root-cause area: `apps/api/src/application/verb-phrases.ts, apps/api/src/application/passive-voice.ts`. Routing: codex.

## Evidence

The task's canonical title 'Partner accepts a shared-budget invitation' was rejected: `TITLE_NOT_VERB_PHRASE: Use case title should be a verb phrase` (digest lines 449-450). Agent kept the wording only via `--force` (narration line 242). Actor-first 'Subject verbs object' is a common, legitimate use-case title form; the heuristic requires a leading verb.

## Recommendation

Soften the verb-phrase check to accept '<Actor> <verb> <object>' forms (or downgrade to a warning rather than a hard rejection). Since the product is Korean-first, ensure the heuristic is not English-only; an over-strict English title rule is a correctness risk for non-English specs.

## Acceptance signal

Re-running the dogfood case that produced this finding no longer
reports it at P0/P1 severity.
