# Next Task

_Auto-generated 2026-05-20T16:53:52Z. Do not hand-edit; use blockers.md for overrides._

```
TASK: Decompose god files (gate 4.C1).

  Files over 1000 lines:
    3306 src/cli/index.ts

  Canonical decompositions:

  • src/infrastructure/prisma-signup-store.ts
      → one prisma-<port>-store.ts per file in src/ports/ (see C2).
        The in-memory siblings under src/infrastructure/memory-*-store.ts
        already model the per-port shape — copy that structure.
      → src/http/server.ts wires each store directly; the
        `serverOptions.signupStore ?? createMemoryX()` chain dissolves.

  • src/cli/index.ts
      → src/cli/commands/<subcommand>.ts per first-word subcommand,
        each extending @oclif/core Command. See C3.

  Stage the split in small PRs (one batch per area) so the test suite
  remains green throughout.

  Commit per batch:
      green(prisma-split): extract prisma-<name>-store
      green(cli-split): extract <subcommand> command
```
