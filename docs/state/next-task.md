# Next Task

_Auto-generated 2026-05-19T22:03:06Z. Do not hand-edit; use blockers.md for overrides._

```
TASK: Rewrite README.md for end users (gate 2.B4).

  1. Move the current "autonomous-build harness" content from README.md
     into docs/build-harness.md (keep the loop instructions intact).
  2. Replace README.md with a user-facing layout:
        # vspec
        <one-paragraph description>
        ## Install            # npm install -g vspec  (or  npx vspec --help)
        ## Run                # local dev: docker compose up -d db && npm run dev
        ## Deploy             # docker compose -f docker-compose.prod.yml up -d
        ## Documentation      # links to docs/ and to docs/build-harness.md
  3. Each section's commands must work on a clean clone — no implicit env
     setup.
```
