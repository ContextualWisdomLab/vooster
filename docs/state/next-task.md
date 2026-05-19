# Next Task

_Auto-generated 2026-05-19T12:55:33Z. Do not hand-edit; use blockers.md for overrides._

```
TASK: Extract layers (gate 1.5).
  - Read: goals/1-runnable.md §5, AGENTS.md "Repository Layout".
  - Move pure business logic from src/http/*-routes.ts into src/application/.
  - Move shared types into src/domain/. Move Prisma adapters into
    src/infrastructure/. Define port interfaces in src/ports/.
  - Configure eslint-plugin-boundaries in eslint.config.js so:
      http → application (allowed)
      http → infrastructure (forbidden)
      application → infrastructure (forbidden; only via ports)
      domain → anything (forbidden)
  - Run: npm run lint, npx vitest run
  - Verify: bash scripts/check-layers.sh
  - Commit: "refactor(layers): extract <slice>"
```
