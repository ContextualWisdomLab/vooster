---
title: "Landing promises spec↔code CI verification that has no implementation (trust gap)"
created_at: 2026-06-02T18:04:29Z
resolved: true
priority: P1
resolved_by:
  - 4b2f7e7
  - e79d701
  - 027a658
  - 6118bb9
status_notes: |
  T4 CLOSED on 2026-06-03 via goal 40 (commit 6118bb9; gate
  goals/40-honest-drift-definition.gates.sh). Evidence: vspec verify
  --format=agent is explicitly tested to expose only deterministic drift kinds
  broken_link, failing_test, and unlinked_step; docs/07-cli-spec.md states that
  drift is not semantic mismatch detection; HowItWorks.astro and
  Onboarding.astro now describe link/test-based verification rather than broad
  spec/code semantic agreement. T1-T4 are closed; T5 remains explicit
  non-blocking stretch/out of scope. Finding resolved true.
  T3 CLOSED on 2026-06-03 via goal 39 (commit 027a658; gate
  goals/39-ci-verify-adapter.gates.sh). Evidence: action.yml is a composite
  adapter that installs the Vooster CLI from the Action checkout, runs
  apps/cli/bin/run.js verify against the caller workspace, maps exit 0 to pass,
  exit 1 to fail, and exit 7 through unlinked-policy fail/warn, and writes the
  captured verify log to the GitHub step summary. .github/workflows/
  vspec-verify.yml invokes the local Action and comments on pull requests when
  verification fails; vspec init --verify-workflow writes a copy-paste workflow
  template for caller repos. Remaining open: T4. T5 remains stretch/out of
  scope for deterministic PR blocking.
  T2 CLOSED on 2026-06-03 via goal 38 (commit e79d701; gate
  goals/38-deterministic-verify.gates.sh). Evidence:
  apps/cli/src/commands/verify.ts routes `vspec verify <KEY-NNN>`, resolves
  step `implements` refs against the local working tree, exits 1 for broken
  links or delegated test failure, exits 7 for otherwise-unlinked steps,
  delegates `--test-cmd` by exit code only, and has a 10-run deterministic JSON
  proof in apps/cli/tests/unit/verify-command.test.ts. Remaining open: T3, T4.
  T5 remains stretch/out of scope for deterministic PR blocking.
  T1 CLOSED on 2026-06-03 via goal 37 (commit 4b2f7e7; gate
  goals/37-step-implements-traceability.gates.sh). Evidence: Step.implements is
  persisted with a default empty array, StoredStep and Prisma mappers carry it,
  contracts validate `implements` refs, markdown imports/exports trailing
  `_(implements: ...)_` annotations, revision hashes include implementation
  links, doctor emits `steps.unlinked`, and CLI step edit rejects malformed refs
  before fetch. Remaining open: T2, T3, T4. T5 remains stretch/out of scope for
  deterministic PR blocking.
related:
  - apps/www/src/components/sections/HowItWorks.astro
  - apps/www/src/components/sections/Onboarding.astro
  - apps/cli/src/commands/diff.ts
  - apps/cli/src/commands/impact.ts
  - apps/cli/src/commands/init.ts
  - apps/cli/src/commands/verify.ts
  - apps/api/prisma/schema.prisma
  - action.yml
  - .github/workflows/vspec-verify.yml
  - docs/07-cli-spec.md
  - docs/findings/2026-05-24T1100-spec-impl-audit.md
---

# Landing promises spec↔code CI verification that has no implementation (trust gap)

## TL;DR

The landing page makes three promises; the third — _"spec과 코드의 일치를 CI에서
자동 검증해, 어긋난 PR을 통과시키지 않습니다"_ (`HowItWorks.astro:18`, visual:
`spec drift detected` / `PR #214 blocked`) — has **no implementation**. There
is no CLI command that scans a codebase or inspects a PR, no data model linking
a spec step to code/tests, and `diff`/`impact` operate on spec **revisions and
entities**, not code. A technical ICP who opens the repo finds this gap and
re-classifies the whole product as over-promising — even though promises (1)
and (2) are genuinely built. This is a **credibility** finding, not just a
missing feature: the distance to close is between landing copy already shipped
and code that doesn't back it.

## Why this matters (ICP context)

The motivating experience is a YC-track pre-seed founder (team ships code via
multiple AI agents) evaluating adoption:

1. Reads the landing: (1) 기획 구조화, (2) 멀티에이전트 Lock, (3) **spec↔code
   CI 검증으로 어긋난 PR 차단.** Promise (3) hits the sharpest pain ("spec
   eventually becomes a lie as code drifts"), so adoption gets serious.
2. Being a technical buyer, opens GitHub and reads `docs/07-cli-spec.md` + the
   architecture.
3. Discovers: `vspec diff` compares spec revisions, `impact` previews spec
   entity impact — and **no command scans code or inspects a PR.** The "PR #214
   blocked" screen is vision, not the current build.
4. Trust breaks. The damaging part: the _other two_ features are well-built,
   yet the one gap re-frames the entire product as "a team that exaggerates."
   The more technical the ICP, the more they open code, and the more one
   verified gap contaminates the real strengths.

So the work here is not "add a feature" — it's **close the distance between an
already-published promise and the code, to recover the trust a code-reading ICP
lost.**

## Reproducer — four verified claims

### Claim 1 — The landing promise and the "blocked PR" visual exist and are shipped

`apps/www/src/components/sections/HowItWorks.astro:18` (step 03 body):

> "시간이 지나면 코드와 spec은 따로 놀게 됩니다. … Vooster는 spec과 코드의
> 일치를 CI에서 자동 검증해, 어긋난 PR을 통과시키지 않습니다."

The accompanying `drift` visual hard-codes the outcome
(`HowItWorks.astro:78,80,81`):

```
❌ spec drift detected
UC-013 · step 3 미구현
PR #214 blocked
```

`apps/www/src/components/sections/Onboarding.astro:103` reinforces it with
`PR #214 ready`.

### Claim 2 — No CLI command scans code or inspects a PR

`apps/cli/src/commands/` has 40+ commands; **none** named `verify`, and a search
for a code/PR-scanning command returns nothing:

```
$ grep -rln "verify" apps/cli/src/commands   # → (no output)
```

The two commands a reader might mistake for spec↔code checks are spec-only:

- `apps/cli/src/commands/diff.ts:30` — `description = "Compare use case
revisions."` Operates on `from`/`to` **revision** args, not code.
- `apps/cli/src/commands/impact.ts` — `description = "Preview impact for a
proposed use case change."` Previews **spec entity** impact, not code impact.

### Claim 3 — No data model links a spec step to code or tests

`apps/api/prisma/schema.prisma:203-219` (`model Step`): fields are
`action`, `invokes String[]`, `is_system_step`, `notes`, `order_index`.
`invokes` references **other spec use cases** — there is no `implements` field
pointing at a file path, code symbol, or test ID. Without that link, an
agreement verdict has only two routes: LLM semantic inference (non-deterministic
— the route we exclude) or following an explicit link (deterministic — which
requires the link to exist as first-class data, and it does not).

### Claim 4 — The CLI spec already self-flags the gap, but the landing does not

`docs/07-cli-spec.md` carries an "MVP implementation status" disclaimer marking
`# 🔵 Planned` commands, and `docs/findings/2026-05-24T1100-spec-impl-audit.md`
audits spec-vs-implementation drift. So the spec layer is honest internally —
but the **public landing copy** makes the unqualified promise, which is exactly
what the ICP reads first.

## Guiding principle for any fix

**Blocking gates run on deterministic checks only. LLM semantic judgment never
blocks a PR (warning-only).** Rationale: a CI gate is trusted only when the same
input yields the same result; flaky LLM verdicts get the gate disabled within a
week. Every ticket below is the deterministic-only path; the semantic ambition
is deliberately quarantined to a non-blocking, opt-in stretch.

## Resolution path (sprint: "Close the Trust Gap")

Founder-of-1 resourcing; each ticket 1–2 days. Commit line: **T1 → T2 → T3**
(these three demo "link → verify → PR blocked"). T4 is copywriting, slotted in.
T5 is explicit stretch.

### TICKET-1 — spec step ↔ code/test traceability link schema _(foundation)_

The root cause of promise (3) being unbuilt: no link exists as first-class data.
This ticket is not "verification" — it is the **only thing that makes
verification deterministic.** Without it, T2 slides into LLM inference and
becomes the flaky gate we set out to avoid.

- Add an `implements` field to each step/scenario — explicit refs to code
  symbols / file paths / test IDs.
- Reflect in both the plain-text spec file and the DB `Revision` (include in the
  content-addressed hash).

**How (mirror the existing `invokes` mechanism — 7 touch points):**

1. `apps/api/prisma/schema.prisma:209` — add `implements String[] @default([])`
   beside `invokes` on `model Step`; one migration.
2. `apps/api/src/domain/entities/step.ts` — add `implements: string[]` to
   `StoredStep` (beside `invokes`).
3. `apps/api/src/infrastructure/prisma-signup-mappers.ts` — carry `implements`
   through `storedStep` (`:243`), `stepData` (`:682`), `stepUpdate` (`:696`).
4. `packages/contracts/src/scenario.ts:58` — add
   `implements: z.array(z.string()).default([])` to `stepStoredResponseSchema`;
   add to `stepPatchRequestSchema` (`:20`) with a `.refine()` on ref format
   (`path` or `path:symbol`) — this `.refine()` is the entry point for the
   "exit code 2 on malformed link" criterion.
5. `apps/api/src/application/markdown-invocations.ts` — clone the
   `_(includes: …)_` parser/serializer pair as an `_(implements: …)_` pair;
   `apps/api/src/application/markdown-renderer.ts:162` appends
   `implementsAnnotation(step.implements)` after `invocationAnnotation(...)`.
   parse↔serialize being inverse is what structurally guarantees the
   round-trip-lossless criterion (`invokes` already passes this way).
6. Content hash needs **no new code**: `revisionContentHash`
   (`prisma-signup-mappers.ts:397`) is `sha256(JSON.stringify(revision.snapshot))`,
   so once step (2)(3) carry `implements` into the snapshot it is hashed
   automatically — add one test asserting the snapshot builder includes it.
7. `apps/api/src/application/doctor.ts` — add a check counting steps with empty
   `implements` (`id: "steps.unlinked"`) → satisfies the "unlinked" query.

Acceptance:

- [x] A step can carry an `implements` list of code/test refs (e.g.
      `tests/UC-013.feature:scenario_login`, `src/auth/login.ts`).
- [x] Links survive markdown import/export round-trips losslessly.
- [x] Steps with no link are queryable as "unlinked" (`doctor` counts them).
- [x] Malformed link → validation rejection before fetch.

Out of scope: auto-linking by AI (non-deterministic — later).

### TICKET-2 — `vspec verify` — deterministic traceability check _(core)_

The missing command behind promise (3). Its value is **not** "it verifies" but
"same input → same result, every time." It checks only: (a) does each link
resolve to a real file/symbol/test, and (b) do the linked tests pass (delegated
to the runner). It does **not** judge semantic correctness.

- New command `vspec verify [<KEY-NNN>]`.

**How:** new `apps/cli/src/commands/verify.ts`, templated on `diff.ts`/`impact.ts`
(oclif `Command`; flags `--api-url` / `--format` / `--session-cookie`, plus
`--test-cmd`). Two pure stages: **(a) resolve** each `implements` ref against the
working tree — file ref → exists; `path:symbol` → symbol present (grep/AST);
test-ID → present in the test list. **(b) run** linked tests by spawning
`--test-cmd` and reading only its exit code (Vooster never parses test output).
Determinism: sort outputs (step_number, then ref), no timestamps/random/map-order
leakage; CI proof is `for i in $(seq 10); do vspec verify; echo $?; done | sort -u
| wc -l` → `1`.

Acceptance:

- [x] All steps linked and targets exist → exit code 0.
- [x] A link target (file/test) missing → exit code 1 + list of broken links.
- [x] Any unlinked step → distinct exit code 7 ("incomplete coverage").
- [x] **10 repeated runs on the same commit → identical results & exit codes
      100% of the time** (verified by repeated CI runs). ← the most important
      criterion.
- [x] Test execution is delegated (`--test-cmd "npm test"`); Vooster never
      interprets test meaning.

Out of scope: LLM "did this code really implement the step" judgment — explicitly
excluded; lives in T5 as non-blocking warning only.

### TICKET-3 — CI gate adapter (GitHub Action)

The landing shows "PR #214 blocked," not a terminal — the ICP's value picture is
"it blocks automatically in CI," not "I run a command locally." A thin layer
mapping `verify` exit codes to PR check status. Also satisfies the data-sovereignty
check (gate runs without Vooster cloud — same binary, same result locally).

**How:** ship `action.yml` + a copy-paste `.github/workflows/vspec-verify.yml`
that runs `vspec verify`; GitHub turns the process exit code into the check
status natively, so the layer is thin. Surface broken links / failing tests via a
PR comment or the Checks API (`gh`). `apps/cli/src/commands/init.ts` optionally
writes the workflow yml. Cloud-independence is automatic if T2 stays a pure
function over (snapshot, working tree, test result).

Acceptance:

- [x] exit 0 → check passes / exit 1 → check fails (merge blocked) / exit 7 →
      warn-or-fail per config.
- [x] Broken links / failing tests surfaced in a PR comment or check detail.
- [x] `vspec init` optionally generates the workflow yml.
- [x] Same binary, same result self-hosted/local (no cloud dependency).

### TICKET-4 — define & label "spec drift" honestly

The landing already uses "drift" strongly, which over-promises _semantic_
mismatch detection. This ticket pins the **definition** to the deterministic
scope so promise and implementation match exactly — trust gaps come from words
promising more than code, not only from missing code.

- Fix `drift` ≝ "broken link, OR linked test failing, OR unlinked step."
- Apply this definition consistently across `verify` output, docs, and landing
  copy.

**How:** have `verify --format=agent` emit `{ drift: [{ kind:
"broken_link" | "failing_test" | "unlinked_step", … }] }` so the 3 deterministic
conditions are the _entire_ surface in code. Edit the landing at
`apps/www/src/components/sections/HowItWorks.astro:18` (step-03 body) and the
`drift` visual at `:78-81` so the copy no longer implies semantic agreement —
reword "자동 검증" toward "link/test-based verification."

Acceptance:

- [x] `vspec verify --format=agent` returns structured drift kinds
      (`broken_link` / `failing_test` / `unlinked_step`).
- [x] Docs state explicitly: "drift is not semantic mismatch but the 3
      deterministic conditions above."
- [x] Landing drift copy (`HowItWorks.astro:18,78-81`) edited to be consistent
      with this definition.

### TICKET-5 — non-blocking semantic check _(STRETCH, only if time remains)_

Keeps the semantic ambition without crossing the safety line: **semantic
judgment warns only, never blocks a PR.** Kept last on purpose — the most common
solo-founder failure is reaching for the "sexy LLM verification" first and never
finishing T1–T3 (the part that actually closes the trust gap), leaving only a
flaky demo that strengthens the code-reading ICP's suspicion.

- `vspec verify --semantic` flag (default off). LLM compares step ↔ linked code
  and emits a "suspicion" list as warnings only.

**How:** add the `--semantic` flag to `verify.ts`; the LLM pass reads each step
plus its `implements`-linked code and writes suspicions to **stderr only**. The
exit code is computed _before_ the semantic pass runs and is never touched by it,
so the deterministic gate stays clean.

Acceptance:

- [ ] Never runs in the default invocation (no deterministic-gate contamination).
- [ ] With `--semantic` on, exit code still reflects deterministic result only;
      semantic suspicions go to stderr as warnings.
- [ ] Output states "this judgment is non-deterministic and does not block PRs."

## Acceptance signal (sprint-level)

When this finding is closeable, a code-reading ICP can re-open GitHub, look at
`vspec verify` + the CI workflow, and truthfully say:

> "The spec-drift verification the landing promised actually works — narrowly
> but honestly. Not semantic inference, but at least a PR is blocked when code
> breaks a spec link. And because the verdict is deterministic, our team trusts
> it enough to leave it on."

Concrete green signals:

- `apps/cli/src/commands/verify.ts` exists and `grep -rln "verify"
apps/cli/src/commands` is non-empty.
- `apps/api/prisma/schema.prisma` `model Step` (or scenario) carries an
  `implements` field included in the revision hash.
- A repeated-run CI check demonstrates identical exit codes across 10 runs on a
  fixed commit (T2 determinism criterion).
- `HowItWorks.astro` drift copy no longer claims semantic agreement beyond the
  3 deterministic drift conditions.

## Goal promotion judgment

**Yes — promote to a goal (likely a small goal chain).** This touches production
code with a gate-able invariant (the T2 determinism criterion is a hard,
enumerable gate), spans the data model + CLI + CI + landing copy, and directly
closes a pre-beta credibility hazard. Suggested split mirrors the commit line:
T1 (schema) and T2 (`verify`) as the chain-blocking core, T3 (CI adapter) and T4
(drift definition + copy) as follow-ons, T5 as an explicit stretch goal kept
non-blocking. When promoting, have each goal's `## Why This Goal Exists` cite
this finding; do not delete this file (mark `status_notes` "promoted to goal N").
