---
case_id: DF-005
severity: P1
resolved: true
---

# Goal 63: Dogfood Finding Follow-Up

> 이 goal을 active로 잡은 에이전트는 먼저
> `guidelines/goal-iteration.md`를 읽어 iteration 프로토콜을 확인할 것.

Resolve the dogfood finding **`vspec doctor` reports clean while per-use-case
quality gates fail; it does not roll up `verify`**.

The finding is recorded inline in this file (see _Source finding_ below); the
`resolved:` flag in the frontmatter above is the structural anchor that
`63-...gates.sh` reads. Flip it to `true` only after the fix lands with test
evidence.

Root-cause area: `apps/api/src/application` (doctor aggregation) and
`docs/07-cli-spec.md` (doctor semantics) — `doctor` runs only project-level
checks and never reflects per-use-case `verify` failures.

## Source finding

A task asked the agent to "fix what doctor reports." `vspec doctor` ran only
project-level checks (`project.exists`, `project.usecases.visible`) and returned
`status: ok`. The real quality signals — POCKET-006 `scenario_completeness:
fail` and `unlinked_steps` on POCKET-001..005 — surfaced only under
`vspec verify <KEY>`, which the agent had to discover and loop over by hand. The
narration captured it plainly: "Project-level doctor is clean but it points to
per-use-case checks." A `doctor` that returns `ok` while `verify` fails teaches
the agent the wrong invariant: that a clean doctor means clean specs when it
does not.

## Completion

A. The source finding is resolved: the `resolved:` frontmatter flag in this
file is set to `true` after the implementation addresses the recommendation
below.

B. The implementation is verified with the smallest relevant test or dogfood
rerun, and this file records that evidence in a _Verification_ section.

## Recommendation

Make `doctor` roll up per-use-case `verify` results so a clean doctor actually
means clean specs. When one or more use cases fail their `verify` gates, the
doctor output must report a non-`ok` status and an actionable pointer to the
failing keys (at minimum: how many failed and which gate); only when no use
case fails may doctor report `status: ok`. Doctor must aggregate over the same
set of use cases that `verify` would check — a project with a failing spec must
never read as clean at the project level. The two surfaces must not disagree
silently: doctor's verdict and the union of per-use-case `verify` verdicts have
to point the agent to the same conclusion, so a passing doctor can be trusted
without re-running `verify` by hand. Per rubric principle, the output must not
mislead the agent into believing the specs are clean when they are not
(`docs/06-api-contract.md`).

## Verification

- RED: `pnpm exec vitest run apps/api/tests/integration/http/doctor-route.test.ts`
  failed because project doctor returned `status: "ok"` while use-case doctor
  returned `issues_found`.
- GREEN: `pnpm exec vitest run apps/api/tests/unit/application/doctor.test.ts apps/api/tests/integration/http/doctor-route.test.ts`
  passes.
- Typecheck: `pnpm --filter @vooster/api typecheck` passes.
