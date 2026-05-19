# Next Task

_Auto-generated 2026-05-19T20:20:20Z. Do not hand-edit; use blockers.md for overrides._

```
TASK: Wire Prisma model 'Comment' through an adapter (gate 2.A3).

  No file under src/infrastructure/ contains prisma.comment.* yet.

  Add src/infrastructure/comment-store.ts (or merge into an existing
  store) and use it from the relevant route via a port. Then extend
  tests/integration/persistence-matrix.test.ts to reference 'Comment'.
  Commit: green(persist): Comment adapter
```
