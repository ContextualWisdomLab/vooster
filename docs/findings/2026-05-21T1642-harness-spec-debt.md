# Findings — harness-engineer / harness-advisor Spec Debt

_Captured 2026-05-22 during the 2nd validation invocation of `harness-engineer`
(`.state/harness/runs/2026-05-21T15:20:52Z.jsonl`). Two grey zones surfaced in
the agent spec that should be resolved before the next round of harness work,
but are not urgent enough to block applying the path-retarget proposals
P1–P5 from prior audits._

## TL;DR

The two improvements both came from the audit running cleanly under the new
spec — they were exposed by what the agent did, not by what it failed at:

1. `harness-advisor` invented a 4th case **(d) documentation lag** that has no
   formal home in `docs/goal-design.md §5`'s (a)/(b)/(c) taxonomy.
2. `harness-engineer`'s report mixed an out-of-scope `.md` edit ("update D1
   prose") into "Proposed changes," even though the spec's separation suggests
   it should sit under "Out-of-scope queued to findings."

Neither blocks current work. Both are queued so the next harness-engineer
spec touch resolves them as a single intentional change instead of being
patched ad hoc on whichever invocation hits the grey zone first.

## Item 1 — case (d) "documentation lag"

### What happened

In the 2nd invocation, `harness-advisor` was asked to classify a mismatch
between `goals/5-monorepo.md:151` (which describes D1 as iterating prior-goal
gate suites) and `goals/5-monorepo.gates.sh:350-356` (which only runs
`check-gate-rigor.sh` and delegates regression to `scripts/completion-check.sh`).
The same pattern appears in 2.D1 and 3.D1.

advisor's verdict (full text in
`.state/harness/advisor/2026-05-21T15:20:52Z-q-d1-regression.md`):

> Classification: **(d) — Documentation lag, not invariant weakening.**
> Coverage unchanged: prior-goal regression is still checked on every
> `completion-check.sh` run. Confidence: High (95%).

### Why this is debt

`docs/goal-design.md §5` enumerates exactly three cases for changing a prior
gate's invariant:

| (a) | Retarget — invariant unchanged, only paths/tools shift |
| (b) | Loosen invariant — verification logic changes |
| (c) | Supersede — invariant is meaningless under new architecture |

advisor's (d) doesn't fit any of these cleanly. The closest is (a)
(invariant unchanged, only the description shifts), but (a) is explicitly
scoped to _paths/tools_, not prose. The result is that the next time a
similar mismatch surfaces, two different harness-engineer invocations could
classify it differently — one as (d), one as (a), one as "n/a" — and the
audit log won't be comparable across runs.

### Options

1. **Add (d) formally to `goal-design.md §5`.** Define it as "the prose in
   `goals/<n>-*.md` describes a superseded design but the gate's invariant
   is correctly enforced by the orchestrator instead. Action: update the
   `.md` prose to match the orchestrator-owned design; no gate change."
2. **Absorb into (a).** Broaden (a)'s definition from "paths/tools only" to
   "any non-invariant-changing edit, including prose realignment." This
   loses the diagnostic value of distinguishing path retargets from prose
   retargets.
3. **Keep advisor judgment case-by-case; do not codify.** Cheaper but
   guarantees recurring drift.

Recommendation when picked up: **option 1**. The (a)/(b)/(c)/(d) split is
useful because each case has a different _who edits what_ answer —
(d) specifically means harness-engineer cannot self-resolve and must escalate
to the user.

### Acceptance signal when resolved

`docs/goal-design.md §5` enumerates four cases, and the agent spec at
`.claude/agents/harness-engineer.md` updates its case-classification
language accordingly.

## Item 2 — "Proposed changes" vs "Out-of-scope queued to findings"

### What happened

In the same report, proposal #6 was "update D1 prose in four `goals/<n>-*.md`
files." The agent correctly noted this is outside its edit scope and tagged
it "사용자 직접 수정 필요." But the item lived under **Proposed changes**
rather than **Out-of-scope items queued to findings** — the two sections
the spec currently defines for that kind of report-output decision.

### Why this is debt

The current `harness-engineer.md` playbook implies a binary:

- **Proposed changes**: edits harness-engineer can apply once the user
  OKs them.
- **Out-of-scope queued to findings**: items harness-engineer cannot edit;
  routed into a `docs/findings/*.md` doc.

A third category exists in practice: **harness-engineer can identify the
fix concretely (the exact file:line and the replacement text) but cannot
execute it because the target is out of edit scope.** Today, those drift
between sections depending on whether the agent leads with "I can describe
the fix" (→ Proposed changes) or "I cannot apply this" (→ Out-of-scope).

### Options

1. **Add a third report section: "Proposed changes (user-applied)."** Distinct
   from harness-applied proposals. Spec the user as the executor; harness
   re-measures after the user reports completion.
2. **Strict separation: any item outside edit scope goes to Out-of-scope
   regardless of how concretely the fix is described.** The finding doc
   then carries the proposed `file:line` + replacement text. Loses some
   readability in the audit report but simplifies the contract.
3. **Status quo with a tiebreaker rule.** e.g., "if the agent cannot edit
   the target, it goes to Out-of-scope, period."

Recommendation when picked up: **option 3** as the cheapest. Option 1 is
nicer but introduces a section the user may forget exists.

### Acceptance signal when resolved

`harness-engineer.md` playbook section "Step 4 — Write the report" specifies
which section catches out-of-scope-but-concrete fixes, and a fresh audit
routes the D1 prose item there.

## Why both are deferred

The path-retarget proposals P1–P5 (from the first audit) are the higher-
value, blocking work — they fix actual `gate-correctness: broken /
net-correctness: violations-currently-missed` findings on the codex loop.
The two grey zones above only affect harness-engineer's _report shape_, not
the correctness of its conclusions. Bundling them into a single small spec
update is cheaper than threading them through the next P1–P5 apply pass.

## Action when picked up

Resolve in this order, in a single focused PR:

1. Add (d) to `docs/goal-design.md §5` (option 1 from Item 1).
2. Add tiebreaker rule to `harness-engineer.md` Step 4 (option 3 from Item 2).
3. Run harness-engineer once to verify both no longer surface as ambiguity.

## Item 3 — HONEST_UC_SET requires manual sync when adding UCs to docs/usecases/

`goals/7-cli-spec-parity.gates.sh` lines ~53–64 hardcode `HONEST_UC_SET` as a
literal array of 10 UC IDs (UC-004, UC-005, UC-006, UC-007, UC-009, UC-011,
UC-013, UC-016, UC-019, UC-022). By design, `docs/usecases/` is not listed in
`GATE_INPUTS` for goal 7 — adding a new UC.md there does not invalidate the
goal-7 cache and does not extend the parity surface the gate iterates over.

Consequence: if a future contributor adds a new `UC-XXX.md` under
`docs/usecases/` without simultaneously editing `HONEST_UC_SET`, goal-7 gates
will silently continue to enforce CLI parity for only the original ten UCs.
The new UC is invisible to the rigor check.

Recommended mitigation: when a future goal introduces new UCs, that goal's
own gates file must explicitly append the new UC IDs to `HONEST_UC_SET` (or,
preferably, convert `HONEST_UC_SET` to a derived list — e.g., the result of
`ls docs/usecases/UC-*.md` — with a documented allow-list of legacy gaps for
UC IDs that intentionally remain outside the honest-flow surface).

## Item 4 — Goal-9 read-path verbs missing API routes (7.C5 regression)

Goal-9's read-path dispatch (actor/stakeholder/goal show/list/edit/archive,
usecase set/restore) routes CLI verbs to API endpoints that don't yet exist
in `apps/api/src/http/`. The honest E2E suite covers seed + CLI dispatch but
6 tests under `scripts/check-honest-cli-e2e.sh` fail because the underlying
HTTP routes return 404, which trips `7.C5`.

Recommended mitigation: inspect `apps/api/src/http/` for the actor,
stakeholder, and goal route files; add the missing read-path handlers
(list/show/edit/archive endpoints) so the honest CLI suite turns green
without weakening 7.C5. This is app-code scope, not harness scope, and
should be picked up as its own goal/tranche.
