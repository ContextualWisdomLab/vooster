---
title: TITLE_NOT_VERB_PHRASE rejects the project's own naming convention and emits a nonsensical suggested title
created_at: 2026-06-04T19:10:26Z
resolved: true
priority: P1
source: dogfood-loop cycle 20260604T184559Z
related:
  - docs/dogfood-loop.md
---

# TITLE_NOT_VERB_PHRASE rejects the project's own naming convention and emits a nonsensical suggested title

**TL;DR.** Fix the verb-phrase heuristic so a title containing a finite verb ("User exports …") is accepted — and at minimum so it agrees with titles already accepted in the same project (POCKET-001). The suggested_titles output is broken: prefixing "Reviews " to the rejected title produces "Reviews user exports their expenses to CSV", which is gibberish and misleading recovery advice. Either generate a real verb-phrase rewrite or drop the suggestion. The heuristic is also an English-only correctness risk per rubric principle 5.

Surfaced by the dogfood loop (cycle `20260604T184559Z`). QUANTS: QNAS.
Root-cause area: `apps/api/src/application (use case title validation / verb-phrase heuristic and suggested_titles generator)`. Routing: codex.

## Evidence

`vspec usecase create --title "User exports their expenses to CSV" --primary-actor "Account Holder" --format=agent` (digest line 35) failed with error code TITLE_NOT_VERB_PHRASE, message "Use case title should be a verb phrase", and details.suggested_titles = ["Reviews user exports their expenses to CSV"]. The existing use case it was asked to mirror is POCKET-001 "User logs a new expense" (digest lines 203/207) — the identical "User <verb> ..." shape. The agent had to retry with --force (digest line 36) and narrated the conflict: "the title was accepted with --force because the validator prefers a leading verb, but I kept the 'User <verb>…' phrasing to stay consistent with POCKET-001" (line 118).

## Recommendation

Fix the verb-phrase heuristic so a title containing a finite verb ("User exports …") is accepted — and at minimum so it agrees with titles already accepted in the same project (POCKET-001). The suggested_titles output is broken: prefixing "Reviews " to the rejected title produces "Reviews user exports their expenses to CSV", which is gibberish and misleading recovery advice. Either generate a real verb-phrase rewrite or drop the suggestion. The heuristic is also an English-only correctness risk per rubric principle 5.

## Acceptance signal

Re-running the dogfood case that produced this finding no longer
reports it at P0/P1 severity.

## Resolution

Updated the title heuristic to accept subject-first finite-verb titles and the
repository's own use-case corpus, and removed the broken English
`Reviews <title>` suggestion path.

Verified with:

- `pnpm --filter @vooster/api typecheck`
- `pnpm exec vitest run apps/api/tests/unit/application/verb-phrases.test.ts apps/api/tests/unit/application/usecases.test.ts`
- `bash goals/49-dogfood-title-not-verb-phrase-rejects-the-project-s-own-na.gates.sh`
