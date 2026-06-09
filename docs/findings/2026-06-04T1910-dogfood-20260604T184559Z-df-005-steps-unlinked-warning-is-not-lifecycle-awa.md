---
title: steps.unlinked warning is not lifecycle-aware, inviting fabricated traceability
created_at: 2026-06-04T19:10:26Z
resolved: false
priority: P2
source: dogfood-loop cycle 20260604T184559Z
related:
  - docs/dogfood-loop.md
---

# steps.unlinked warning is not lifecycle-aware, inviting fabricated traceability

**TL;DR.** Make the unlinked-steps check status-aware: suppress or downgrade it for DRAFT / pre-implementation use cases, or word the warning so it reads as advisory traceability deferred until code exists, rather than a defect to remediate — so agents don't fabricate links to pass the check.

Surfaced by the dogfood loop (cycle `20260604T184559Z`). QUANTS: NS.
Root-cause area: `apps/api/src/application (doctor steps.unlinked heuristic)`. Routing: codex.

## Evidence

Per-use-case doctor emitted `steps.unlinked` on all five DRAFT use cases (e.g. line 985 "5 step(s) have no implementation link"; lines 1026, 1077, 1128, 1179, 1230). The agent established (narration lines 138-159) that this is a spec-only, pre-implementation repo with no source to link to, so the only way to clear the warning would be inventing `--implements` references. A less careful agent would have degraded the specs to silence it.

## Recommendation

Make the unlinked-steps check status-aware: suppress or downgrade it for DRAFT / pre-implementation use cases, or word the warning so it reads as advisory traceability deferred until code exists, rather than a defect to remediate — so agents don't fabricate links to pass the check.

## Acceptance signal

Re-running the dogfood case that produced this finding no longer
reports it at P0/P1 severity.
