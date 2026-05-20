# Next Task

_Auto-generated 2026-05-20T03:28:57Z. Do not hand-edit; use blockers.md for overrides._

```
TASK: Slim down a fat route file (gate 2.C1).

  Candidate: src/http/api-key-routes.ts (209 lines)

  1. Identify the route's business logic vs. parsing/validation.
  2. Extract logic into src/application/<area>.ts as pure functions taking
     port interfaces (no Fastify import).
  3. Add tests/unit/application/<area>.test.ts that exercises those
     functions directly.
  4. The remaining route file should only:
        - parse + validate the request (zod)
        - call the application function
        - serialize + send the response
     (Validation problems and HTTP-shaped errors stay in src/http.)
  Commit:
     refactor(layers): extract <area> from <route>
```
