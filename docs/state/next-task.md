# Next Task

_Auto-generated 2026-05-19T21:52:29Z. Do not hand-edit; use blockers.md for overrides._

```
TASK: Make vspec deployable via Docker (gate 2.B3).

  - Add Dockerfile (multi-stage: deps → build → runtime, node:20-alpine).
    Final stage runs `node dist/src/index.js` and exposes 3000.
  - Add docker-compose.prod.yml with:
      app:    builds the Dockerfile, depends_on db, exposes ${VSPEC_DEPLOY_HOST_PORT:-4400}:3000
      db:     postgres:16-alpine with a healthcheck
    Pass DATABASE_URL via environment in the app service.
  - Verify:
        bash scripts/check-deployable.sh
```
