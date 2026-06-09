# Goal 54: Dogfood Finding Follow-Up

> 이 goal을 active로 잡은 에이전트는 먼저
> `guidelines/goal-iteration.md`를 읽어 iteration 프로토콜을 확인할 것.

Resolve the dogfood finding **`usecase verify` produces no usable output, so the
agent abandons it and verifies via `usecase show`**.

Source finding: `docs/findings/2026-06-04T1910-dogfood-20260604T184559Z-df-004-usecase-verify-produces-no-usable-output-so.md`

Root-cause area: `apps/cli/src/commands (usecase verify) and apps/api/src/application; docs/07-cli-spec.md`

## Background

`usecase verify` already supports `--format=agent` and reports spec→implementation
link drift (`broken_links`, `unlinked_steps`, `failing_tests`). What it does NOT
report is the **structural coherence of the use case itself** — whether the
use case is missing the pieces an agent needs before it can act. So when the
dogfood agent ran `vspec usecase verify $k`, the default output looked like an
inert verdict, the agent assumed it was interactive/empty, dropped `verify`
entirely, and fell back to `usecase show --format=agent` to confirm coherence by
hand. A `verify` that yields nothing actionable for structural gaps is a
core-workflow gap (and duplicates df-006 'usecase verify returns opaque output').

## Completion

A. The source finding is marked `resolved: true` after the implementation
addresses the recommendation below.

B. The implementation has been verified with the smallest relevant test or
dogfood rerun, and the finding document records that evidence (the specific
test name or command whose output flips from opaque to actionable).

## Recommendation

Make `usecase verify` emit a deterministic, non-interactive structural verdict in
addition to the existing link drift, and surface it under every output format:

1. **Structural completeness checks.** `verify` reports a structured list of
   coherence checks covering each of the four use-case structural dimensions:
   - **primary actor** — the use case has a non-empty primary actor;
   - **level** — the use case declares a Cockburn level;
   - **stakeholders** — at least one stakeholder interest is attached;
   - **extensions** — extension/alternate scenarios are present (or the absence
     is reported as an explicit `missing`, not silently omitted).

   None of the four dimensions may be silently dropped: a use case missing all
   four must produce a check entry for each, each carrying a `missing` status, so
   an agent that implements only one dimension's check does not satisfy the goal.

2. **Deterministic pass/fail rollup.** The overall `status` and `exit_code`
   account for structural gaps (not only link drift), and `--format=agent`
   carries the per-dimension checks inside the envelope `data` so an agent can
   act on them programmatically. Under `--format=agent` no human-only prose lines
   are mixed into stdout.

3. **Non-interactive human output.** The default (human) format prints a clear,
   self-describing verdict — never a bare/blank line that reads as an interactive
   prompt — so the failure that triggered this finding (agent assuming `verify`
   was interactive) cannot recur.

Document the structural-checks shape under the existing Verify section of
`docs/07-cli-spec.md`. Per rubric principle 2, the verdict must be
self-teaching: the output tells the agent which dimension is missing and what to
do next (`docs/06-api-contract.md`).

## Scope Guards

- No change to the existing link-drift semantics (`broken_links`,
  `unlinked_steps`, `failing_tests`) beyond folding structural gaps into the
  shared `status` / `exit_code` rollup.
- No prior goal gate may be weakened to pass this goal.

