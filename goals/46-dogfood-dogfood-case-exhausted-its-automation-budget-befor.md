# Goal 46: Dogfood Finding Follow-Up

Resolve the dogfood finding **Dogfood case exhausted its automation budget before completion**.

Source finding: `docs/findings/2026-06-02T2303-dogfood-dogfood-case-exhausted-its-automation-budget-befor.md`

Root-cause area: `apps/cli/src and apps/api/src/application/ai-guide.ts`

## Completion

A. The source finding is marked `resolved: true` after the implementation
addresses the recommendation below.

B. The implementation has been verified with the smallest relevant test or
dogfood rerun, and the finding document records that evidence.

## Recommendation

Reduce cold-start recovery loops: make ai-guide/help/errors teach the authenticated init-to-use-case path without source spelunking or repeated failed commands.
