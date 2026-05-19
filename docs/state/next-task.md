# Next Task

_Auto-generated 2026-05-19T08:17:17Z. Do not hand-edit; use blockers.md for overrides._

```
TASK: Migrate one route to Prisma persistence (gate 1.2).
  - Read: goals/1-runnable.md §2, docs/05-data-model.md.
  - Pick the lowest-UC entity that still uses in-memory state. Candidate:
      src/http/branch-routes.ts
  - Write a failing integration test in
      tests/integration/<entity>-persists.test.ts
    that boots createServer twice against the same SQLite file and asserts
    state survives between boots.
  - Ensure prisma/schema.prisma has the entity; if not, add it.
    Run: npx prisma migrate dev --name add-<entity>.
  - Replace the in-memory store with a Prisma-backed port in
    src/infrastructure/<entity>-repo.ts, exposed via a port interface in
    src/ports/<entity>-repo.ts, consumed by src/application/<entity>-service.ts.
  - Delete the in-memory Map in the same commit. Do not keep both.
  - Verify: npx vitest run tests/integration/<entity>-persists.test.ts
  - Verify goal-0 still green: bash goals/0-init.gates.sh
  - Commit: "green(persist): <entity> backed by prisma"
```
