# Next Task

_Auto-generated 2026-05-20T19:19:33Z. Do not hand-edit; use blockers.md for overrides._

```
TASK: Create per-port Prisma adapters (gate 4.C2).

  Each port under src/ports/ must have a matching prisma adapter.
  Missing:
    src/infrastructure/prisma-stakeholder-interest-store.ts
    src/infrastructure/prisma-actor-store.ts
    src/infrastructure/prisma-scenario-store.ts
    src/infrastructure/prisma-revision-store.ts
    src/infrastructure/prisma-step-store.ts
    src/infrastructure/prisma-api-key-store.ts
    src/infrastructure/prisma-stakeholder-store.ts
    src/infrastructure/prisma-work-session-store.ts
    src/infrastructure/prisma-merge-request-store.ts
    src/infrastructure/prisma-goal-store.ts
    src/infrastructure/prisma-membership-store.ts
    src/infrastructure/prisma-project-store.ts
    src/infrastructure/prisma-lock-store.ts
    src/infrastructure/prisma-workspace-store.ts
    src/infrastructure/prisma-usecase-store.ts
    src/infrastructure/prisma-branch-store.ts
    src/infrastructure/prisma-user-store.ts
    src/infrastructure/prisma-comment-store.ts

  Steps per port:
    1. Copy the structure from the sibling memory-<name>-store.ts.
    2. Replace in-memory ops with PrismaClient calls.
    3. Update src/http/server.ts to wire prisma-<name>-store (in
       Postgres mode) instead of dereferencing the dissolved
       SignupStore intersection.
    4. Run npm test — the persistence-matrix test will catch any
       behaviour drift.

  Commit per port:
      green(prisma-split): prisma-<name>-store
```
