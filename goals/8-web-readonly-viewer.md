# Goal 8: Web Read-Only Viewer (Next.js 15 on Vercel)

> 이 goal을 active로 잡은 에이전트는 먼저
> `guidelines/goal-iteration.md`를 읽어 iteration 프로토콜을 확인할 것.

## Why This Goal Exists

`docs/00-overview.md` 가 약속한 _"minimal Web UI (read, review, merge)"_
중 **read** 단계가 비어 있다. 현재 `apps/www` 는 한국어 마케팅 랜딩이고,
인증된 read 표면은 부재. AI agent 는 CLI 로 spec 을 pin/edit 하지만 사람
리뷰어가 spec 을 살펴볼 표면이 없다.

Goal 8 은 그 표면을 만든다. 마치고 나면:

- `apps/web` 이 Next.js 15 App Router 로 존재한다.
- 인증된 사용자가 프로젝트 → UC 목록 → UC 상세까지 탐색할 수 있다.
- 모든 페이지가 Server Component 로 동작 (CSR/state library 없음).
- Playwright (chromium only) 가 핵심 사용자 여정을 honest E2E 로 검증.
- Vercel 프로젝트 `vooster-new-web` 이 GitHub 연동되어 자동 배포되고,
  최신 배포가 `Ready` 상태로 등록되어 있다.

API 가 아직 어디에도 라이브로 배포되지 않았으므로 실제 접속 시 데이터
페치가 500 일 수 있다 — 이건 본 goal 의 스코프 밖이다. Vercel CLI 가
**프로젝트 + 빌드 + 배포 상태**까지 확인해주면 충분하다. API 배포 / DB
호스팅 / write/review/merge UI 는 후속 goal.

`scripts/check-gate-rigor.sh` 가 아래 모든 universal claim 에 대응하는
iteration 이 gate 에 있음을 메타-검증한다.

## Self-Audit (per `docs/goal-design.md §5`)

이 goal 은 prior goal 5 의 A3 invariant 와 충돌한다:

> `goals/5-monorepo.md:58` — "apps/ contains exactly three
> subdirectories: api, cli, www."

`apps/web` 추가는 멤버십 셋을 `{api, cli, web, www}` 로 바꾼다. `.md`
본문이 "three" 라는 _count_ 를 명시하므로 단순 path retarget(case a)
이 아니라 **case (b) loosen invariant** 다 (`.md` 본문도 같은 커밋에서
업데이트되어야 universal claim ↔ gate 일치 유지).

처리 방침:

1. Goal 8 의 첫 커밋이 `refactor(goal-5): admit apps/web to A3 declared
set` — `goals/5-monorepo.md` 의 A3 prose 와 디렉토리 enumeration,
   `goals/5-monorepo.gates.sh` 의 expected `ACTUAL_APPS` 셋 양쪽을
   동시에 `{api, cli, web, www}` 로 수정.
2. 같은 커밋에 다른 의도(scaffold 등) 절대 conflate 금지. 다음 커밋부터
   apps/web 실제 내용물.
3. Goal 5 의 다른 게이트 (B6 every app declares build/test/typecheck,
   B7 api build, C1-C5 www) 는 손대지 않음 — `apps/web` 이 들어가면
   B6 enumerator 가 자동으로 web 도 보게 되므로, **Goal 8 의 scaffold
   가 그 요건을 만족해야 한다** (build/test/typecheck script 모두 존재).

`## Supersedes` 섹션은 없다 — Goal 5 의 invariant 가 사라지는 것이
아니라 멤버 셋이 확장되는 것뿐.

## The Goal

Every condition below holds. Gates iterate; a single example does not
satisfy them.

### Tranche A — Workspace integration (Goal 5 retarget + scaffold)

A1. **`goals/5-monorepo.md` A3 prose declares the four-app set.** The
gate greps that the file mentions `web` alongside `api`, `cli`,
`www` in the A3 paragraph. (Acceptance criterion for the Goal 5
loosening commit.)

A2. **`apps/web/package.json` exists with `"name": "@vooster/web"` and
`"private": true`.** The gate parses the JSON with `node -e`.

A3. **`apps/web/package.json` depends on Next.js 15.** Specifically,
the `next` semver range starts with `15.` or `^15.`. The gate
parses the manifest and asserts the major.

A4. **Every workspace-config file required by Next.js 15 exists at
`apps/web/`.** Source of truth: the declared list
`(tsconfig.json next.config.ts tailwind.config.ts postcss.config.mjs)`.
The gate iterates and asserts file presence.

A5. **`apps/web` declares `build`, `test`, `typecheck`, and `test:e2e`
scripts.** Source of truth: the declared list
`(build test typecheck test:e2e)`. The gate iterates and asserts
each script key exists in `apps/web/package.json` (this strengthens
Goal 5 B6 for the new app — extending the script list).

A6. **`pnpm --filter @vooster/web build` produces `apps/web/.next/`.**
_(The build command itself is enforced by `goals/_meta.md` M.4 — the
meta gate enumerates every app under `apps/_`with a`build`script.
    This goal's gate verifies the`.next/`directory is the resulting
    artifact. In CI, where`\_meta`is skipped, the workflow's explicit
    build step produces`.next/` for this gate to find.)\*

### Tranche B — Read-only viewer pages (Tier 1)

B1. **Every Tier-1 page file exists.** Source of truth: the declared
page set
`     app/(app)/page.tsx
    app/login/page.tsx
    app/(app)/projects/[key]/page.tsx
    app/(app)/projects/[key]/usecases/[ucKey]/page.tsx
    `
The gate iterates and asserts each path under `apps/web/` exists.
`app/(app)/page.tsx` is the project list (the "home" surface); a
separate `app/projects/page.tsx` is intentionally absent. The
`(app)` route group wraps every authenticated surface under one
shared layout (chrome + auth).

B2. **Every Tier-1 page is a Server Component.** The gate iterates the
same page set and asserts the file does **not** open with
`"use client"` (case-insensitive, top-of-file directive only —
nested components may be client, but the page export cannot be).

B3. **Every Cockburn UC field is rendered on the detail page.** Source
of truth: the declared field set
`(title primary_actor level status main_scenario extensions
      stakeholder_interests)`. The gate iterates and asserts each
identifier appears at least once in
`apps/web/app/projects/[key]/usecases/[ucKey]/page.tsx` (or in a
component file imported by it — the gate widens the grep to the
UC detail subtree).

B4. _Removed 2026-05-23._ The original B4 forbade write API calls under
`apps/web/app/`. The web app's scope has since expanded beyond
read-only viewer to include project CRUD (`createProject`,
`renameProject`, `deleteProject`) per commits 840b64f / 6b377a4.
The "no writes" invariant is therefore deleted outright rather
than reframed — write-side UI is a legitimate part of the web
surface now. No replacement invariant in this goal; any future
write-API discipline (e.g. "all writes route through
`mutateApi`") would be a new goal's concern.

### Tranche C — Auth (session-cookie reuse)

C1. **`apps/web/app/login/page.tsx` links to `/v1/auth/github/start`.**
The gate greps the file for the literal path.

C2. **Server-side fetches in `apps/web/app/` forward the
`vspec_session` cookie.** Source of truth: every `*.tsx` / `*.ts`
file under `apps/web/app/` that calls `fetch(`. The gate iterates
those files and asserts each fetch invocation is accompanied by a
`cookies()` call (Next.js 15 async cookies API) within the same
file. A file with `fetch(` but no `cookies()` fails the gate.

C3. **Every authenticated route is wrapped by the redirect-enforcing
`(app)` layout.** Source of truth: the declared set
`(app/(app)/page.tsx app/(app)/projects/[key]/page.tsx
      app/(app)/projects/[key]/usecases/[ucKey]/page.tsx)` (`/login`
excluded). The gate iterates the set and asserts each file
resides under `app/(app)/` (i.e., shares the route group), and
separately asserts `app/(app)/layout.tsx` references `redirect(`
from `next/navigation` and the string `/login`. The layout
centralizes auth — individual pages no longer carry their own
redirect — and the iteration enforces that every authenticated
surface is structurally inside that layout.

### Tranche D — Playwright E2E (honest)

D1. **`apps/web/playwright.config.ts` declares chromium only.** The
gate greps for `name: "chromium"` and asserts no `firefox` or
`webkit` project entry exists.

D2. **Every Tier-1 page has a matching Playwright test.** Source of
truth: the Tier-1 page set from B1. For each page, the gate
iterates and asserts at least one `.spec.ts` under
`apps/web/tests/e2e-web/` contains a `page.goto(...)` whose path
matches the page's route (e.g., `app/projects/page.tsx` ↔
`page.goto("/projects")`).

D3. **No Playwright test under `apps/web/tests/e2e-web/` calls
`fetch(` directly.** Honest invariant: setup + assertions go
through the browser (`page.goto`, `page.click`, `expect(page)`).
The gate iterates every `*.ts` under the directory and fails on
any `fetch(` match.

D4. **Every Playwright test sets `VSPEC_AUTH_STUB=1` in the launched
server's env.** The gate iterates `*.spec.ts` files under
`apps/web/tests/e2e-web/` and asserts each references
`VSPEC_AUTH_STUB`. (Pattern: set via Playwright `webServer.env`
in `playwright.config.ts`; tests reference the env or a helper
that sets it.)

D5. **`pnpm --filter @vooster/web test:e2e` exits 0.** Deep gate;
skipped when `VSPEC_GATES_SKIP_DEEP=1`.

### Tranche E — Vercel deployment

E1. **`apps/web/vercel.ts` exists and declares
`framework: "nextjs"`.** The gate greps for the export shape and
the framework string.

E2. **The Vercel project name `vooster-new-web` is referenced by
`apps/web/vercel.ts` (or a sibling marker file).** Source of
truth: the gate's `VERCEL_PROJECT_NAME=vooster-new-web` constant.
The gate greps `apps/web/` for that string.

E3. **The most recent production deployment of `vooster-new-web`
reports `Ready` status.** The gate runs
`vercel inspect $(vercel ls $VERCEL_PROJECT_NAME --prod --limit=1 ...)`
(or the simpler `vercel ls vooster-new-web` and parses the first
row's Status column) and asserts the literal `● Ready`. Deep gate;
skipped when `VSPEC_GATES_SKIP_DEEP=1` or when Vercel CLI is
not authenticated (the latter prints an actionable hint pointing
at `vercel login`).

E4. **The Vercel project is GitHub-linked.** Source of truth:
Vercel project JSON (`vercel api /v9/projects/vooster-new-web`,
or `vercel project inspect vooster-new-web --json` when supported)
returns a `link.type` of `github` (or the analogous nested key —
the gate accommodates the CLI's actual JSON shape; a string match
on `"type":"github"` suffices). Deep gate.

### Tranche F — Meta: rigor

F1. **`scripts/check-gate-rigor.sh goals/8-web-readonly-viewer.md`
passes.** Every universal claim above is paired with a
`for|while|find|xargs` iteration in
`goals/8-web-readonly-viewer.gates.sh`.

## Scope Guards (additive to Goals 0–7)

- **No write/edit UI in this goal.** No form submitting POST/PUT/PATCH/
  DELETE to the API anywhere in `apps/web/`. Comments, locks, branches,
  merges, edit-in-place are Goal 9+.
- **No client-side state library.** No Redux/Zustand/Jotai/SWR/TanStack
  Query. Server Components + native `fetch` only. The fetch is
  server-side; the cookie is forwarded via Next.js `cookies()`.
- **No real-time updates / WebSockets.** Polling-only would also be
  out of scope — the read-only viewer is page-load fetch.
- **No merging `apps/www` and `apps/web`.** They are distinct surfaces
  (marketing landing vs. authenticated app). Both stay independently
  buildable and independently deployable.
- **No API deployment in this goal.** The Vercel deploy is web-only.
  Runtime 500 on data fetch is acceptable for Goal 8 — the gate only
  verifies the build + deploy status, not runtime data.
- **No DB hosting decision in this goal.** Picking Neon/Supabase/etc.
  is a follow-up that pairs with API deployment.
- **No new auth surface.** Reuse the existing
  `GET /v1/auth/github/start` redirect flow. No separate web-only
  OAuth client, no JWT, no next-auth.
- **No widening the Tier-1 page set within this goal.** Adding
  `/projects/[key]/sessions`, `/projects/[key]/branches`, etc. is
  Goal 9. The set declared in B1 is closed for the duration of Goal 8.
- **No silencing Playwright deep gates.** D5 and E3 can be skipped
  via `VSPEC_GATES_SKIP_DEEP=1` for warm iterations, but
  `bash scripts/completion-check.sh` (no skip) must still pass.
- **No bypassing Goal 5 invariants.** The retarget commit (Tranche A
  prerequisite) must update both `goals/5-monorepo.md` prose and
  `goals/5-monorepo.gates.sh` enumeration in the same commit. Editing
  only one fails Goal 5 in the next sweep.

## Mandatory First Step (every iteration)

```
bash scripts/diagnose.sh
```

## Mandatory Reading Order

1. `AGENTS.md` — TDD protocol + commit shape.
2. `docs/goal-design.md` — harness contract; case (a)/(b)/(c) rules.
   This goal triggers case (b) on Goal 5 — read §5 before the first
   commit.
3. `docs/00-overview.md` — read/review/merge web UI promise.
4. `docs/01-architecture.md` — web UI as a separate deploy unit.
5. `docs/02-tech-stack.md` — Next.js 15 + Tailwind + shadcn/ui +
   Playwright + Vercel decisions.
6. `goals/5-monorepo.md` — A3 invariant being loosened (case b).
7. `goals/8-web-readonly-viewer.md` — this file.
8. `docs/state/next-task.md` and `docs/state/blockers.md`.
9. Narrow technical reference per task:
   - Tranche B: Next.js 15 App Router docs (async `cookies()`,
     dynamic route segments).
   - Tranche C: `apps/api/src/http/signup-routes.ts` for the cookie
     name `vspec_session` and the start URL.
   - Tranche D: Playwright `webServer` config for spinning the dev
     server inside the test runner.
   - Tranche E: `vercel.ts` config schema (per `@vercel/config/v1`).

## Recommended Order of Attack

`goals/8-web-readonly-viewer.next-task.sh` enforces this order.

1. **Goal 5 retarget commit (A1 prerequisite).** Update
   `goals/5-monorepo.md` A3 prose to declare four apps; update
   `goals/5-monorepo.gates.sh` `ACTUAL_APPS` expected set to
   `api cli web www`. Commit:
   `refactor(goal-5): admit apps/web to A3 declared set`.

2. **Workspace scaffold (A2-A6).** Create `apps/web/` with
   `package.json` (Next.js 15 dep, build/test/typecheck/test:e2e
   scripts), `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`,
   `postcss.config.mjs`, minimal `app/layout.tsx` + `app/page.tsx`,
   `playwright.config.ts` (chromium only), `tests/e2e-web/` with a
   smoke test, and `vercel.ts`. Verify
   `pnpm --filter @vooster/web build` passes locally.

3. **Tier-1 pages (B1-B3).** Author each page in the declared set.
   UC detail page renders all fields from B3. Use Server Components
   only.

4. **Auth wiring (C1-C3).** Login page; cookie forwarding via
   `cookies()`; unauthenticated redirect to `/login`.

5. **Playwright tests (D1-D5).** One spec per Tier-1 page. Browser
   only — never `fetch(` from a test. Uses
   `VSPEC_AUTH_STUB=1` via `playwright.config.ts` `webServer.env`.

6. **Vercel project (E1-E4).** Create the `vooster-new-web` project
   via `vercel link` (or via the Vercel dashboard linking the GitHub
   repo); commit `apps/web/vercel.ts`; push to GitHub; verify
   `vercel inspect` reports `Ready` on the latest production
   deployment.

7. **Rigor sweep (F1).** Run
   `bash scripts/check-gate-rigor.sh goals/8-web-readonly-viewer.md`.

8. **Full completion check.** `bash scripts/completion-check.sh` —
   goals 0–8 all pass.

## The TDD Loop

Same red → green → refactor as prior goals. Reusable scopes:

- `refactor(goal-5): <description>` — A1 retarget commit only
- `feat(web): <description>` — apps/web scaffold, pages, auth
- `test(web-e2e): <description>` — Playwright specs
- `chore(web): <description>` — config files, vercel.ts
- `chore(deploy): <description>` — Vercel project setup notes

## Forbidden Actions (additive to Goals 0–7)

- Adding `"use client"` to any Tier-1 page top-level export. Nested
  client components are fine; the page itself must be a Server
  Component.
- Calling `fetch(` from a Playwright test file. The honest invariant
  is that the test drives the browser, not the API.
- Adding a write-side API call from `apps/web/`. Read-only is the
  whole point of Goal 8.
- Conflating the Goal 5 retarget commit with apps/web scaffold work.
  Two separate commits, retarget first.
- Touching `apps/www`. The Korean landing is a separate surface and
  is owned by Goals 4/5.
- Introducing a state library (Redux/Zustand/SWR/TanStack Query) for
  this read-only surface.
- Silencing Vercel CLI auth errors. If `vercel whoami` fails the gate
  surfaces an actionable hint (`vercel login`) — never fall back to a
  pass.
- Deploying the API to Vercel in this goal. That is a separate
  goal-level decision (likely Goal 9 or 10) that requires its own
  retarget of Goal 2 invariants.

## Completion Check

```
bash scripts/completion-check.sh
```

Exit 0 only when goals 0, 1, 2, 3, 4, 5, 6, 7, and 8 all pass their
gates.

## Now Begin

Run: `bash scripts/diagnose.sh`
