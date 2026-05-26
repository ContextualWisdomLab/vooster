# AGENTS.md — apps/app

Read-first product web app (`@vooster/app`, Next.js 15 App Router on Vercel).
Authenticated users browse projects → use-case list → use-case detail, plus a
fixed allowlist of writes (management plane: project admin; review plane:
comments). Spec-content authoring, branch/merge/lock/revert are CLI-only and
must not be added here. All pages are Server Components; data is fetched
server-side from the API with the `vspec_session` cookie forwarded. The scope
model, page map, consumed API, and write allowlist live in
`docs/10-web-app.md` — keep them in sync with any change here.

## Boundaries

- This app talks to the vspec API over HTTP; it does not import from
  `apps/api`. Treat the API as a contract (`docs/06-api-contract.md`).
- UI primitives live under `components/ui/` (shadcn). Compose them; don't fork.

## Delegated builds (headless)

When you are invoked headless as a delegated build (the goal's `.md` has a
`## Delegation` section, `owner: claude` — see `docs/claude/delegation.md`):

- You are completing **one step** of the goal, not the whole goal. The step is
  in the prompt; acceptance is the goal's gate suite.
- **Commit your step**: one commit per step, Conventional Commits format (e.g.
  `feat(web): uc-detail page`), then stop. Follow the root `/commit` skill for
  message format and the pre-commit boundary.
- **Stay inside `apps/app`.** Never edit `apps/api`, `apps/www`, `domain`,
  `scripts/`, or `goals/` — they are off-limits for this app's delegation.
- Keep pages Server Components and the surface read-only unless the current
  step's goal explicitly says otherwise.
