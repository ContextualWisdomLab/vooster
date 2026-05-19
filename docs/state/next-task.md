# Next Task

_Auto-generated 2026-05-19T09:07:11Z. Do not hand-edit; use blockers.md for overrides._

```
TASK: Add CLI E2E for UC-004 (gate 1.4).
  - Read: docs/usecases/UC-004-create-project.md
  - Create tests/e2e-cli/UC-004.test.ts that:
      • Starts a fresh Fastify server on a random port (real DB, temp dir).
      • Spawns the CLI as a child process (execa or node:child_process).
      • Asserts the CLI command finishes with exit 0 and prints expected output.
  - Commit: "green(cli): UC-004 CLI E2E"
```
