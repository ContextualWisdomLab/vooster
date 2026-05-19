# Next Task

_Auto-generated 2026-05-19T08:54:37Z. Do not hand-edit; use blockers.md for overrides._

```
TASK: Add CLI E2E for UC-002 (gate 1.4).
  - Read: docs/usecases/UC-002-login.md
  - Create tests/e2e-cli/UC-002.test.ts that:
      • Starts a fresh Fastify server on a random port (real DB, temp dir).
      • Spawns the CLI as a child process (execa or node:child_process).
      • Asserts the CLI command finishes with exit 0 and prints expected output.
  - Commit: "green(cli): UC-002 CLI E2E"
```
