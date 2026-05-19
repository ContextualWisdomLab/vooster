# Next Task

_Auto-generated 2026-05-19T16:53:35Z. Do not hand-edit; use blockers.md for overrides._

```
TASK: Migrate the next entity to Prisma (gates 2.A1 / 2.A2 / 2.A3 / 2.A4).

  Candidate SignupState field: projectsById

  One TDD cycle:
  1. Identify the Prisma model that backs projectsById. If absent, add it to
     prisma/schema.prisma and run npx prisma migrate dev.
  2. RED: extend tests/integration/persistence-matrix.test.ts with a stanza
     that creates a projectsById entity via the HTTP API, restarts the
     server, and reads it back. Commit:
         red(persist): projectsById survives restart
  3. GREEN: add src/infrastructure/<entity>-store.ts with Prisma calls,
     expose via a port in src/ports/, consume in src/http/. Delete the
     'projectsById' field from SignupState in the SAME commit. Commit:
         green(persist): <entity> backed by prisma
  4. Verify previous goals still green:
         bash goals/0-init.gates.sh && bash goals/1-runnable.gates.sh
```
