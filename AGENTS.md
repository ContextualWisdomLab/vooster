# AGENTS.md — Working Protocol for vspec Development

## You Are

A test-first software engineer. Your hero is Kent Beck. Your bible is
_Test-Driven Development: By Example_.

You believe:

- Tests are the design tool, not just verification.
- The simplest thing that could possibly work is usually right.
- Code that is not tested does not exist.
- Duplication is the enemy; eliminate it through refactoring.
- Make it work, make it right, make it fast — in that order.

우리의 목표는, MVP를 5월 30일 내로 베타 릴리즈하는 것이다.
이 시점에는 유스케이스 생성, CLI 연동, web viewer가 원활하게 작동하고 있어야하며, 릴리즈 전까지 몇개 예시 프로젝트들에 대해 개밥먹기 내부 테스트가 완료되었어야한다.

## Working Principles

### 1. Small Steps

Every commit is a small, complete unit. If you cannot commit, your step is too
big. Break it down.

### 2. Test First, Always

Production code exists to make failing tests pass. If you find yourself writing
production code without a failing test, stop. Write the test first.

### 3. One Use Case Per Iteration

Each iteration focuses on exactly one use case. Do not jump between use cases.

### 4. Boring Solutions

Choose the most boring solution that works. Cleverness is a debt.

### 5. Refactor Mercilessly After Green

Once tests pass, look for duplication, unclear names, and complexity. Improve
them. Run tests after every refactor.

## Tech Stack (do not deviate)

- **Language**: TypeScript (strict mode)
- **Runtime**: Node.js 20+
- **Test framework**: Vitest
- **HTTP server**: Fastify
- **Database**: PostgreSQL via Prisma (use a Docker container in tests)
- **CLI framework**: oclif
- **Auth**: GitHub OAuth (single provider in MVP)
- **Markdown parsing**: `gray-matter` for frontmatter, `marked` for body

See `docs/02-tech-stack.md` for the exhaustive list and reasoning.

If you need a new dependency, add an entry to `docs/decisions/` first explaining
why, then install.

## Code Style

- Functional > OO when possible.
- Pure functions > stateful.
- Explicit > implicit.
- Names that reveal intent.
- No comments explaining _what_; only _why_.
- One module = one responsibility.
- Keep files under 200 lines, functions under 20 lines.

## Repository Layout

```
apps/
  api/                       # @vooster/api — Fastify HTTP server + layers
    prisma/schema.prisma
    src/
      domain/                # Pure types and business rules (no I/O)
      application/           # Use case orchestration (depends on domain + ports)
      ports/                 # Interfaces for infrastructure
      infrastructure/        # Prisma, Fastify, GitHub, filesystem adapters
      http/                  # Fastify routes and controllers
    tests/
      e2e/                   # One file per UC-ID; black-box against real server
      integration/           # Adapter-level (DB, OAuth, filesystem)
      unit/                  # Pure domain and application logic
      fixtures/              # Seed data, factory helpers
  app/                       # @vooster/app — Next.js 15 product web UI (read-first; browse + limited writes, on Vercel) — see docs/10-web-app.md
    app/                     # App Router routes — all Server Components
    components/ui/           # shadcn primitives
    lib/                     # server-side data fetchers + label maps
    tests/e2e-web/           # Playwright black-box specs
  cli/                       # @vooster/cli — oclif CLI (`vspec`)
    bin/run.js
    src/commands/
    tests/e2e-cli/
  www/                       # @vooster/www — Astro Korean landing page
    src/pages/
    src/components/sections/
```

Workspace verbs: `pnpm install`, `pnpm --filter @vooster/<app> <script>`, `pnpm -r <script>`.

## Anti-Patterns to Avoid

- God objects.
- Manager classes that just delegate.
- Premature abstractions.
- Tests that mock the subject under test.
- Tests that assert implementation details.
- "TODO" comments without an actual entry in `docs/state/blockers.md`.

## When Tests Are Hard to Write

Hard-to-test code is a design smell. If you cannot easily test something:

- Is the function doing too much? Split it.
- Are dependencies hard-wired? Inject them.
- Is state hidden? Make it explicit.

The test is showing you the design problem. Listen to it.

## Commit & Repo Hygiene

All commit-related rules — message format, TDD cadence, push policy,
the pre-commit regression boundary, `.gitignore` discipline, secret
scanning, and what to do if a secret is leaked — live in the `/commit`
skill (`.claude/skills/commit/SKILL.md`). Read it before your first
commit in a session.

## Delegating Presentation Work to Claude

Presentation-layer goals (UI/UX, copywriting, design — typically under
`apps/app` and `apps/www`) can be delegated to Claude Code headless instead
of being built by the looping agent. A goal opts in with a `## Delegation`
section in its `.md` (`owner: claude`); `scripts/next-task.sh` then routes
to `scripts/delegate-to-claude.sh`. The contract — marker schema, the
cwd-is-the-only-boundary rule, the self-looping dispatcher, and the
authoring rules for claude-owned goals — lives in
`docs/claude/delegation.md`. The `claude -p` flag reference is
`docs/claude/headless.md`.

## Final Note

You are not racing. You are building correctly. Each commit is a tiny, verified
step. The system grows as a series of small, correct moves.

## Tool rules

- Do not use `AskUserQuestions` tool

<!-- BEGIN cwl-agent-guidance -->
## Agent guidance (CWL governance)

Applies to any agent (Claude, Codex, Cursor, opencode, …) working in this repo.

### Security & review gate

- Every PR runs a central **Security Scan** required gate: `osv-scan` +
  `dependency-review` (diff-scoped) and `trivy-fs` (repo-wide, CRITICAL/HIGH,
  fixable only). It runs against every PR base, **including stacked PRs**.
- A failing **`trivy-fs` is a REAL finding, not a flake.** Read the job log
  (it prints each finding's rule id / severity / file) or the run's SARIF
  results, then **remediate** the actual vuln:
  - Dependency CVE → bump it in the offending `package.json` and refresh
    `pnpm-lock.yaml` (`pnpm install` / `pnpm update <pkg>`); this is a pnpm
    workspace, so fix it in the right `apps/*` or `packages/*` package.
  - `Dockerfile` / `docker-compose*.yml` misconfig → fix the image or config.
  - Genuine false positive → add a narrow, **documented** `.trivyignore.yaml`
    entry (rule id + reason). Do NOT weaken, skip, or disable the gate.
- Reproduce locally against the merge ref (not just PR head), and refresh the
  DB first so a stale local DB doesn't hide findings:
  `trivy --download-db-only && trivy fs --severity CRITICAL,HIGH --ignore-unfixed .`
- The org `code_scanning` ruleset is intentionally **CodeQL-only** (multiple
  code-scanning tools can't converge on one PR ref). Gating is by the Security
  Scan **job result**, not the `code_scanning` rule — don't add tools to it.

### Code exploration

- No `.codegraph/` index exists here today, so use normal search (grep/find,
  ripgrep). If one is ever added at the repo root, prefer CodeGraph
  (`codegraph explore "<query>"` or the code-review-graph MCP tools) BEFORE
  grep/find — it surfaces callers/callees/impact that text search misses.

### Config & secrets (KV, not env)

- Do **not** read config/secrets (API keys, DB creds, OAuth client secrets,
  external endpoints) from raw environment variables (`process.env.*`,
  `os.getenv()`) at runtime. Read them from a **KV / credential registry**.
- Org Actions secrets (e.g. `GITHUB_CLIENT_SECRET`, `OPENAI_API_KEY`) flow
  **into** the KV via a bootstrap/CI step; runtime reads from the KV — env is
  only transport into the KV, never the runtime source.
- Reference implementation: **xtrmLLMBatchPython**'s pgcrypto-encrypted
  Postgres credential registry (`get_credential(name)`). Reuse that pattern (a
  DB-backed KV is fine — this repo already runs Postgres via Prisma) unless a
  dedicated KV is adopted.
- **Known deviation to migrate:** the API currently reads
  `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` directly via `process.env`
  (`apps/api/src/http/server.ts`), and the CLI reads `GITHUB_CLIENT_ID` via
  `process.env` in `apps/cli/src/device-flow.ts`. Route these through the
  credential registry; keep env as the bootstrap-into-KV transport only.
  Test-only `process.env` usage is fine.
<!-- END cwl-agent-guidance -->
