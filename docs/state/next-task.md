# Next Task

_Auto-generated 2026-05-19T12:06:56Z. Do not hand-edit; use blockers.md for overrides._

```
TASK: Add CLI E2E for UC-031 (gate 1.4).
  - Read: docs/usecases/UC-031-export-markdown.md
  - Create tests/e2e-cli/UC-031.test.ts that:
      • Starts a fresh Fastify server on a random port (real DB, temp dir).
      • Spawns the CLI as a child process (execa or node:child_process).
      • Asserts the CLI command finishes with exit 0 and prints expected output.
  - Commit: "green(cli): UC-031 CLI E2E"
```
