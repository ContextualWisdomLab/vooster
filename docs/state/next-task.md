# Next Task

_Auto-generated 2026-05-19T08:39:08Z. Do not hand-edit; use blockers.md for overrides._

```
TASK: Add CLI E2E for UC-001 (gate 1.4).
  - Read: docs/usecases/UC-001-signup.md
  - Create tests/e2e-cli/UC-001.test.ts that:
      • Starts a fresh Fastify server on a random port (real DB, temp dir).
      • Spawns the CLI as a child process (execa or node:child_process).
      • Asserts the CLI command finishes with exit 0 and prints expected output.
  - Commit: "green(cli): UC-001 CLI E2E"
```
