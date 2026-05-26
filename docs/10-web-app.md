# 10 — Web App (`apps/app`)

`@vooster/app` is the human-facing web application: a Next.js 15 (App Router)
product surface where an authenticated person browses a workspace's specs
(projects → use cases → use-case detail) and performs a small, fixed set of
write actions. It is the sibling of three other surface contracts —
`06-api-contract.md` (HTTP), `07-cli-spec.md` (CLI), `08-file-format.md`
(markdown). It is **not** the marketing site (that is `apps/www`).

All pages are React Server Components; data is fetched server-side from the
vspec API with the caller's session cookie forwarded. The app treats the API
as a contract and never imports from `apps/api`.

## Scope — the two-plane model

The app is **read-first**. It is not "read-only" (it has write affordances) and
it is not a full CRUD client. Writes are allowed only on two narrow planes, and
each write the app performs must be enumerated in the [write allowlist](#write-allowlist)
below — that list is the sync anchor for this document.

| Plane          | What it covers                                                           | Why it belongs in the web app                    |
| -------------- | ------------------------------------------------------------------------ | ------------------------------------------------ |
| **Management** | Project (and, when built, workspace / membership) administration         | Low-frequency, human, no locks/revisions needed. |
| **Review**     | Lightweight reviewer actions a person does in-browser (comment, resolve) | Review, not authoring.                           |

**Forbidden in the web app — CLI / agent only:** all spec-content _authoring_
(use cases, scenarios, steps, actors, goals, stakeholder interests) and all
branch / merge / lock / revert operations. Those need optimistic concurrency
(`base_revision`), locks, revision history, and the agent envelope — that
machinery lives behind the CLI (`07-cli-spec.md`) and must not be reimplemented
here.

**Authorization is the API's job.** The app surfaces affordances and reflects
the API's allow/deny; it does not reimplement role checks. A delete the API
rejects (e.g. non-owner, project has dependencies) surfaces as an error.

## Stack & deployment

Next.js 15 App Router, React 19, Tailwind v4, shadcn/ui (radix-ui), lucide
icons — see `02-tech-stack.md` for rationale. Deployed on Vercel (project
`vooster-new-web`, configured in `apps/app/vercel.ts`). UI copy is Korean,
hardcoded, no i18n.

## Page map

All `(app)/*` routes require a session and live behind the route-group layout
(`app/(app)/layout.tsx`), which redirects to `/login` when the session cookie
is absent.

| Route                              | File                                | Purpose                                                                                          |
| ---------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------ |
| `/login`                           | `app/login/page.tsx`                | "Continue with GitHub" → links to API `/v1/auth/github/start`.                                   |
| `/`                                | `app/(app)/page.tsx`                | Project list (cards + sidebar).                                                                  |
| `/projects/[key]`                  | `app/(app)/projects/[key]/page.tsx` | Use-case list for a project, with actor/scenario/extension counts.                               |
| `/projects/[key]/usecases/[ucKey]` | `.../usecases/[ucKey]/page.tsx`     | Use-case detail: primary actor, level, status, main scenario, extensions, stakeholder interests. |

## Consumed API surface

Every endpoint the app calls lives in `app/data.tsx` (HTTP transport in
`app/api-client.tsx`, demo/stub responses in `app/data.stub.tsx`). This table is
the seam to `06-api-contract.md`; when the API contract changes, this is what
breaks.

| Method & path                           | Plane              | Used by               |
| --------------------------------------- | ------------------ | --------------------- |
| `GET /v1/projects`                      | read               | home + sidebar        |
| `GET /v1/projects/{key}/usecases`       | read               | project page          |
| `GET /v1/projects/{key}/actors`         | read               | project page (counts) |
| `GET /v1/usecases/{ucKey}?format=agent` | read               | use-case detail       |
| `POST /v1/projects`                     | write (management) | create project        |
| `PATCH /v1/projects/{id}`               | write (management) | rename project        |
| `DELETE /v1/projects/{id}`              | write (management) | delete project        |

> **Coupling to note:** use-case detail consumes the **agent envelope**
> (`?format=agent`, see UC-034 / `usecase-agent`), the same payload the CLI/agent
> reads — not a web-specific shape. Changes to that envelope affect this page.

## Write allowlist

The only writes the app performs today, plus writes the plane model _permits_
but which are **not yet built**. Anything not listed here is forbidden (see
[Scope](#scope--the-two-plane-model)). Add a write → add a row here.

| Write                            | Plane      | Status                                               |
| -------------------------------- | ---------- | ---------------------------------------------------- |
| Create / rename / delete project | management | **Implemented** (`app/actions.tsx` → `app/data.tsx`) |
| Invite member / change role      | management | Allowed, not yet built                               |
| Create workspace                 | management | Allowed, not yet built                               |
| Add / resolve comment (UC-028)   | review     | Allowed, not yet built                               |

## Auth & session model

- The browser OAuth flow is the **API's** (`/v1/auth/github/start` →
  `/v1/auth/github/callback`); the API sets the `vspec_session` cookie. The app
  only links to the start URL and reads the resulting cookie.
- `app/auth.tsx` (`hasSessionCookie`) gates the `(app)` layout; missing cookie →
  redirect to `/login`.
- Every server-side fetch forwards `Cookie: vspec_session=…` (`app/api-client.tsx`
  `readApi` / `mutateApi`) and uses `cache: "no-store"`.

## Demo / stub mode

`VSPEC_AUTH_STUB=1` short-circuits auth (`hasSessionCookie` → true) and serves
in-memory demo data instead of calling the API, including a mutable demo project
store so create/rename/delete work offline. The fixtures, the demo store, and
the `isAuthStub()` toggle all live in `app/data.stub.tsx`. This is the mode the
Playwright suite and local UI work run in.

| Env var           | Default                 | Purpose                              |
| ----------------- | ----------------------- | ------------------------------------ |
| `VSPEC_API_URL`   | `http://127.0.0.1:3000` | API base URL for server-side fetch.  |
| `VSPEC_AUTH_STUB` | unset                   | `1` = bypass auth + serve demo data. |

## Testing

- **Unit** (`tests/unit/`, vitest): label maps, project-key helper, stub data
  layer.
- **E2E** (`tests/e2e-web/tier1.spec.ts`, Playwright/chromium): black-box
  against the running app in stub mode — page map, login link, and the project
  create/rename/delete flows. Gated behind `VSPEC_GATES_SKIP_DEEP` (see
  `02-tech-stack.md`).

## Presentation

How the app _labels and explains_ domain terms (canonical Korean labels,
on-demand `?` popovers, never leaking snake_case field names) is owned
separately:

- Principles: `apps/app/DESIGN.md`
- Glossary source: `docs/findings/2026-05-25T1503-web-viewer-de-jargon.md`
- Implementation: `apps/app/lib/labels.ts` (+ `TermLabel`)

## Document ownership

To keep this in sync, each doc has one job:

- **`docs/10-web-app.md`** (this file) — canonical architecture & contract:
  scope, page map, consumed API, write allowlist, auth.
- **`apps/app/DESIGN.md`** — presentation / labeling principles.
- **`apps/app/AGENTS.md`** — working rules for building inside `apps/app`.
