# Next Task

_Auto-generated 2026-05-20T15:50:40Z. Do not hand-edit; use blockers.md for overrides._

```
TASK: Move Stored<Model> types into src/domain/ (gates 4.B1 / 4.B2).

  These domain types are still absent from src/domain/:
    StoredUser
    StoredWorkspace
    StoredMembership
    StoredProject
    StoredActor
    StoredStakeholder
    StoredGoal
    StoredUseCase
    StoredScenario
    StoredStep
    StoredStakeholderInterest
    StoredRevision
    StoredSpecBranch
    StoredMergeRequest
    StoredWorkSession
    StoredLock
    StoredComment
    StoredApiKey

  Plan:
    1. mkdir -p src/domain/entities
    2. For each model in prisma/schema.prisma, create
       src/domain/entities/<lowercase-name>.ts that exports the
       Stored<Model> type currently living in src/http/signup-types.ts
       (and the few neighbours: src/http/api-key-types.ts,
       comment-types.ts, merge-request-types.ts).
    3. Add a barrel: src/domain/entities/index.ts re-exporting all.
    4. Delete the Stored* declarations from src/http/.

  Note: keep the StoredX SHAPE byte-for-byte identical. This is a
  mechanical relocation, not a redesign.

  RED commit:
      red(domain): assert every Prisma model has a domain entity
  GREEN commit:
      green(domain): relocate Stored* types into src/domain/entities
```
