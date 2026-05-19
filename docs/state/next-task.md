# Next Task

_Auto-generated 2026-05-19T21:37:02Z. Do not hand-edit; use blockers.md for overrides._

```
TASK: Align DB configuration (gate 2.B2).

  Bring these four files to agreement on DATABASE_URL shape:
    - prisma/schema.prisma         (datasource provider)
    - .env.example                  (DATABASE_URL example)
    - package.json                  (start / prestart scripts)
    - docker-compose.yml + docker-compose.prod.yml

  Rule of thumb:
    - Production / dogfood:  Postgres   (postgresql://…)
    - Tests / local dev:     SQLite     (file:.state/…sqlite)

  Either:
    a) Switch the schema to env("DATABASE_PROVIDER") and document the
       split in docs/02-tech-stack.md, OR
    b) Make .env.example point at SQLite and document Postgres as a
       prod-only override.

  Then run: bash scripts/check-db-consistency.sh
```
