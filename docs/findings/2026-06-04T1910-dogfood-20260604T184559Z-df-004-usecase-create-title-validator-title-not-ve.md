---
title: usecase create title validator (TITLE_NOT_VERB_PHRASE) contradicts the tool's own seed use cases and isn't self-teaching
created_at: 2026-06-04T19:10:26Z
resolved: true
priority: P1
source: dogfood-loop cycle 20260604T184559Z
related:
  - docs/dogfood-loop.md
---

# usecase create title validator (TITLE_NOT_VERB_PHRASE) contradicts the tool's own seed use cases and isn't self-teaching

**TL;DR.** Either align the validator with the tool's own seed/Cockburn convention (accept subject-led 'User <verb>s ...' titles) or, if verb-first is intended, make the seed examples conform AND make the error self-teaching: include a concrete rewrite example and a `--force` hint in `details`/`suggested_next_actions`. A validator that rejects the product's own example data is a contract-consistency bug, not a heuristic nit.

Surfaced by the dogfood loop (cycle `20260604T184559Z`). QUANTS: NTA.
Root-cause area: `apps/api/src/application (use-case title validation) and/or apps/cli/src; error envelope in packages/contracts/src`. Routing: codex.

## Evidence

Digest cmd 12 `vspec usecase create --title "User invites a partner to a shared budget" ...` failed; "Error codes seen" lists `TITLE_NOT_VERB_PHRASE` with message "Use case title should be a verb phrase" (digest lines 101, 367-368). Agent then ran cmd 13 to inspect, cmd 14 with `--force`, and applied `--force` to all three creates (cmds 14-16). Narration (line 127): "The title validator is a heuristic; existing use cases use the same 'User …' style, so I'll proceed with `--force`." The seed use case POCKET-001 is titled "User logs a new expense" (digest line 210), i.e. the validator rejects the exact convention the tool itself shipped.

## Recommendation

Either align the validator with the tool's own seed/Cockburn convention (accept subject-led 'User <verb>s ...' titles) or, if verb-first is intended, make the seed examples conform AND make the error self-teaching: include a concrete rewrite example and a `--force` hint in `details`/`suggested_next_actions`. A validator that rejects the product's own example data is a contract-consistency bug, not a heuristic nit.

## Acceptance signal

Re-running the dogfood case that produced this finding no longer
reports it at P0/P1 severity.

## Resolution

Aligned the validator with subject-led finite-verb titles, removed forced
`usecase create` examples from the AI guide, and made rejected-title responses
include accepted rewrite suggestions plus a reasoned `--force` escape hatch.

Verified with:

- `pnpm --filter @vooster/api typecheck`
- `pnpm exec vitest run apps/api/tests/unit/http/usecase-results.test.ts apps/api/tests/unit/application/verb-phrases.test.ts apps/api/tests/unit/application/usecases.test.ts`
- `bash goals/52-dogfood-usecase-create-title-validator-title-not-verb-phra.gates.sh`
