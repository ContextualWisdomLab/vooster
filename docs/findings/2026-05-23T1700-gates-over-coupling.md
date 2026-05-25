---
title: "Harness scripts (gates.sh + next-task.sh) are over-coupled to code/doc form"
created_at: 2026-05-23T17:00:00Z
priority: P1
resolved: partial
status_notes: "2026-05-26: Goal 11-29 gates/next-task trims landed; 2026-05-23: Goal 22 gates/next-task trim landed as the first per-goal sub-trim; remaining goals 7-10 are still queued."
related:
  - docs/goal-design.md
  - guidelines/goal-iteration.md
  - docs/findings/2026-05-23T1700-dogfood-followups.md
  - docs/findings/2026-05-23T1750-dogfood-roundtrip.md
---

# Findings — Harness scripts are over-coupled to code/doc form

_Original scope: `goals/*.gates.sh`. Extended later in the same session
to `goals/*.next-task.sh` after applying the same lens — see the
section "The same analysis extends to `next-task.sh`" below._

_Recorded 2026-05-23 during the goal-30 dogfood-roundtrip authoring
session. Source conversation: the user asked "왜 gates.sh 가 이렇게
길어야 돼?" and the analysis below was the answer._

## TL;DR

Most existing `goals/*.gates.sh` files (7 onward) check **convention
adherence** disguised as **invariant enforcement**:

- They grep for specific function names, type fields, test titles, and
  file paths.
- The same invariants are also enforced by tests, typecheck, and
  coverage — which run as part of goal-0's gate suite anyway.
- The grep checks are tightly coupled to current code/doc structure
  and fail spuriously under benign refactors (renaming a helper,
  moving a test, restructuring a heredoc).

This produces gate files in the 200–400 line range when the real,
**only-gates-can-do-it** content is closer to 30–60 lines. Goal-30 was
deliberately written short (~63 lines) as a reference implementation;
the older goals are queued for the same trim.

## What gates.sh can uniquely do

After honest decomposition, only three categories belong here:

1. **The rigor mechanism from `goal-design.md §1`.** If the goal `.md`
   claims universality ("every entity must X"), the gate must
   enumerate from a source of truth. `scripts/check-gate-rigor.sh` is
   the meta-check for this.
2. **Universal claims that aren't expressible as a test.** Two
   patterns qualify:
   - **Negative invariants over the whole codebase**
     (`grep -r "<forbidden pattern>" src/` returns zero), e.g. "no
     command file still calls `requiredFlag("project-id")`".
   - **Cross-source-of-truth enumeration** (every UC markdown file has
     a matching test) where the truth lives in the filesystem, not in
     a callable code path.
3. **Document existence / structural anchors** the harness needs to
   route subsequent work (e.g. a follow-ups findings file must exist
   so deferred work isn't lost).

Anything else is more honestly expressed elsewhere.

## What gates.sh should stop doing

Each of the patterns below appears repeatedly across `goals/7-*`
through `goals/29-*`. The "better tool" column is the right home.

| Current gate pattern                                   | Better tool         | Why                                                                                                                                                                                    |
| ------------------------------------------------------ | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `grep -F "buildAgentEnvelope" <command>.ts`            | Test                | If the command's agent branch isn't building an envelope, the unit/E2E test for `--format=agent` fails. Grep is a proxy that breaks under refactor (e.g. delegating through a helper). |
| `grep -F "data.merge_request.id" <test>.ts`            | Test                | The test either asserts the field and passes, or doesn't and fails. Grepping its source for the field name verifies nothing the test itself doesn't.                                   |
| `grep "new_revisions: Array<{" <output>.ts`            | typecheck           | TypeScript already enforces type shapes. If a consumer reads `body.new_revisions[0].id` and the type omits it, `tsc` fails.                                                            |
| `grep -F "agent merge resolve" <test>.ts` (test title) | Test runner         | Either the test exists and runs, or it doesn't. The title string is arbitrary; what matters is what the test asserts.                                                                  |
| `[ -f "<test>.ts" ]` at a specific path                | Coverage threshold  | "This code path must be exercised by tests" is what coverage thresholds express. Locking the test to one path file blocks reorganization.                                              |
| `grep -F "### Agent Format - X" <spec>.md`             | Code review         | Doc structure is a human concern. CI enforcing exact section headings creates friction without invariant guarantee.                                                                    |
| Bullet-removal tracking in `findings/*.md`             | Commit message / PR | Whether a finding is "closed" is a PR-level decision, not a CI invariant. The file isn't a contract; it's a queue.                                                                     |

## What good looks like

A minimal `.gates.sh` for the dogfood round-trip (was drafted as
`goals/30-dogfood-roundtrip.gates.sh`; the goal has since been
converted to a P0 findings doc — see
[2026-05-23T1750-dogfood-roundtrip.md](./2026-05-23T1750-dogfood-roundtrip.md)).
The 63-line file reduces to:

```
A1. docs/findings/2026-05-23T1700-dogfood-followups.md exists.
G1. scripts/check-gate-rigor.sh passes.
```

The goal `.md` documents the behavioral invariants in plain language
and points to the test suite as the proof. Tests verify behavior;
typecheck verifies shapes; coverage verifies that the verifying tests
ran.

Cost of the trim:

- **Lost**: per-token "the agent forgot to write X" pinpoint messages
  inside `gates.sh`. These are replaced by the test runner's own
  diff/assertion output, which is more accurate (it tells you what
  _broke_, not what _grep didn't find_).
- **Gained**: refactor freedom. Renaming a helper, moving a test file,
  restructuring a heredoc no longer breaks the gate.
- **Gained**: maintainability. Fewer lines to read and audit.
- **Gained**: honesty. The gate now claims only what it actually
  enforces.

## Migration plan for existing goals

Progress:

- 2026-05-23: `22-comment-agent-format` was trimmed first. Its gate now keeps
  only the prior-sentinel retarget check, focused unit Vitest proof, honest CLI
  Vitest proof, and gate rigor; the exact source/test/doc token greps moved to
  behavior tests or review. Its `next-task.sh` now routes from the gate result
  instead of prescribing helper names, file paths, or doc headings.
- 2026-05-26: `20-who-agent-format` was trimmed to the same pattern. Its gate
  keeps sentinel preservation, focused unit Vitest proof, honest CLI Vitest
  proof, the Goal 7 UC-set negative invariant, and gate rigor; its
  `next-task.sh` now points to goal tranches instead of helper names and test
  paths.
- 2026-05-26: `18-history-agent-format` was trimmed to the same pattern:
  sentinel preservation, focused unit Vitest proof, honest CLI Vitest proof,
  the Goal 7 UC-set negative invariant, and gate rigor.
- 2026-05-26: `19-impact-agent-format` was trimmed to the same pattern:
  sentinel preservation, focused unit Vitest proof, honest CLI Vitest proof,
  the Goal 7 UC-set negative invariant, and gate rigor.
- 2026-05-26: `21-revert-agent-format` was trimmed to the same pattern:
  sentinel preservation, focused unit Vitest proof, honest CLI Vitest proof,
  the Goal 7 UC-set negative invariant, and gate rigor.
- 2026-05-26: `23-member-api-key-agent-format` was trimmed to the same
  pattern: sentinel preservation, focused unit Vitest proof, honest CLI Vitest
  proof, the Goal 7 UC-set negative invariant, and gate rigor.
- 2026-05-26: `24-local-context-agent-format` was trimmed to the same pattern:
  sentinel preservation, focused unit Vitest proof, honest CLI Vitest proof,
  the Goal 7 UC-set negative invariant, and gate rigor.
- 2026-05-26: `25-project-create-agent-format` was trimmed to the same pattern:
  sentinel preservation, focused unit Vitest proof, honest CLI Vitest proof,
  the Goal 7 UC-set negative invariant, and gate rigor.
- 2026-05-26: `26-pull-sync-agent-format` was trimmed to the same pattern:
  sentinel preservation, focused unit Vitest proof, honest CLI Vitest proof,
  the Goal 7 UC-set negative invariant, and gate rigor.
- 2026-05-26: `27-push-agent-format` was trimmed to the same pattern: sentinel
  preservation, focused unit Vitest proof, honest CLI Vitest proof, the Goal 7
  UC-set negative invariant, and gate rigor.
- 2026-05-26: `28-lock-renew-agent-format` was trimmed to the same pattern:
  sentinel preservation, focused unit Vitest proof, honest CLI Vitest proof,
  the Goal 7 UC-set negative invariant, and gate rigor.
- 2026-05-26: `29-merge-resolve-agent-format` was trimmed to keep the findings
  sentinels, the production `__test` negative invariant, focused unit and CLI
  E2E Vitest proofs, the no-honest-E2E boundary, and gate rigor.
- 2026-05-26: `17-merge-open-agent-format` was trimmed to keep findings
  sentinels, the merge-resolve public-setup deferral boundary, focused unit and
  honest CLI Vitest proofs, the Goal 7 UC-set negative invariant, and gate
  rigor.
- 2026-05-26: `16-change-agent-format` was trimmed to keep findings sentinels,
  focused unit and honest CLI Vitest proofs, the Goal 7 UC-set negative
  invariant, and gate rigor.
- 2026-05-26: `15-scenario-agent-format` was trimmed after adding explicit
  `context.revision` assertions to the focused unit and honest CLI proofs; the
  gate now keeps findings sentinels, those Vitest proofs, the Goal 7 UC-set
  negative invariant, and gate rigor.
- 2026-05-26: `14-step-agent-format` was trimmed after adding explicit step-add
  `context.revision` assertions to the focused unit and honest CLI proofs; the
  gate now keeps findings sentinels, those Vitest proofs, the Goal 7 UC-set
  negative invariant, and gate rigor.
- 2026-05-26: `13-lock-agent-format` was trimmed to keep findings sentinels,
  focused unit and honest CLI Vitest proofs, the Goal 7 UC-set negative
  invariant, and gate rigor.
- 2026-05-26: `12-branch-agent-format` was trimmed to keep the findings
  sentinel, the API-does-not-own-agent-envelope negative invariant, focused
  unit and honest CLI Vitest proofs, the Goal 7 UC-set negative invariant, and
  gate rigor.
- 2026-05-26: `11-session-agent-format` was trimmed to keep the findings
  sentinel, focused unit and honest CLI Vitest proofs, the Goal 7 UC-set
  negative invariant, and gate rigor.

The trim is straightforward but needs to be done per-goal so prior
invariants aren't accidentally weakened.

For each goal `n` in `7..29`:

1. List every gate check in `goals/n-*.gates.sh`.
2. Classify each into one of:
   - **Keep** — falls in one of the three "uniquely gates" categories
     above.
   - **Move to test** — the assertion belongs in a unit/E2E test.
     Confirm the test already exists and asserts it; if not, add it
     in the same PR.
   - **Move to typecheck** — the assertion is a type shape; confirm
     `tsc` already covers it.
   - **Move to coverage** — the assertion is "test file exists";
     confirm a coverage threshold or named-test invariant covers it.
   - **Delete** — the assertion is convention-only (test title text,
     section heading text, bullet removal); document the convention in
     the PR template instead.
3. Rewrite `goals/n-*.gates.sh` keeping only the "Keep" set.
4. Update `goals/n-*.md` to drop universal-phrasing for claims now
   covered by tests, so `check-gate-rigor.sh` still passes.
5. Run `bash scripts/completion-check.sh` to confirm the goal still
   reports passing.

Each goal trim is its own PR. Per `goal-design.md §5`, the classification
is **case (b) — Loosen invariant** at the gate level, but the underlying
invariant is unchanged because it migrates to another verifying tool
(test / typecheck / coverage). The commit message should make this
explicit: `refactor(goals/n): move gate checks to tests, no invariant
change`.

Recommended order — start with the smallest, most boilerplate-heavy
goals so the pattern is established:

```
22-comment-agent-format       (single verb, small)
20-who-agent-format           (single verb, small)
18-history-agent-format       (single verb, small)
... continue through 11-29 ...
10-agent-write-path           (multi-site, requires care)
7-cli-spec-parity             (broadest, do last)
```

Goal 0 / 1 / 2 / 3 / 4 / 5 / 6 / 8 / 9 are different in character
(infrastructure / monorepo / db) and should be reviewed separately
— they may have legitimate `grep` invariants over generated artifacts
(Prisma schema, etc.) that don't fit the "tests cover it" pattern.

## When to keep a grep gate anyway

Three legitimate reasons to keep a content grep in `gates.sh`:

1. **The thing being checked isn't reached by any test path.** Build
   artifacts, generated code, or non-executable files (Docker
   compose, package.json scripts).
2. **The check is over a source of truth the test framework can't
   enumerate.** Markdown files in `docs/usecases/`, Prisma models in
   `schema.prisma`, route files matched by a directory glob.
3. **A negative invariant** ("no file under `src/` calls X") that
   would require N tests to verify behaviorally but is a single grep
   in a gate.

If the grep doesn't fit one of those, prefer a test.

## The same analysis extends to `next-task.sh`

After the gates.sh trim, we examined `next-task.sh` under the same
lens. The conclusion is _similar but not identical_: next-task isn't
an invariant enforcer (it's advisory text), so the cost of over-
coupling is lower — but mechanism prescription in next-task carries
a different harm. It **constrains agent design freedom** by channeling
implementation toward whatever the hint author imagined first.

### What next-task should do (I): workflow state detection

`next-task.sh` runs at t=0 of each iteration, when tests for the goal
may not yet exist. Without a working test suite to fail, the agent has
no behavioral signal for "where am I in this goal." `next-task.sh`
fills that gap by inspecting **loose state proxies**:

- File existence (does the RED test for Tranche B3 exist yet?)
- Negative codebase grep (zero callers of forbidden pattern?)
- Optionally: parse `gates.sh` output

These signals describe _progress_, not _form_.

### What next-task should not do (II): mechanism prescription

The same way gates.sh shouldn't grep for `buildAgentEnvelope` in a
function body, `next-task.sh` shouldn't say:

- "Use `resolveContextFlag` as the helper name."
- "The test title must be exactly `agent X verb`."
- "Call `GET /v1/projects/<key>`."
- "Write the test at exactly `apps/cli/tests/unit/foo.test.ts`."

These are mechanism processing the hint author guessed. They:

- Make the hint stale under refactor.
- Channel the agent into the first solution shape the author imagined.
- Forbid the agent from finding a better helper, a better path, a
  better API contract.

The validity check is the same as for gates: **"if the agent finds a
better way, does the hint have to change?"** If yes, that part is
mechanism — strip it and let the goal `.md` carry the intent.

### Reference

The minimal `next-task.sh` for the same round-trip (was drafted as
`goals/30-dogfood-roundtrip.next-task.sh`; same conversion to findings
applies). 98 lines, 7 branches:

- Each branch keys on a loose state signal (file existence / negative
  grep), not a symbol grep.
- Each heredoc references the matching Tranche in
  the matching Tranche section in
  [2026-05-23T1750-dogfood-roundtrip.md](./2026-05-23T1750-dogfood-roundtrip.md)
  and says "RED first" — nothing
  about specific symbols, titles, URLs, or paths.

The 172→98 line trim is purely (II) mechanism prescription removal;
(I) state detection is preserved. Workflow channeling — the only
function tests/typecheck/coverage can't provide — stays intact.

## Migration plan for `next-task.sh` files

Per-goal trim, same procedure as gates.sh:

1. List every branch in `goals/n-*.next-task.sh`.
2. For each heredoc, strikethrough every line that prescribes a
   specific helper name, test title, file path, or URL.
3. Replace those lines with a Tranche reference (`See goals/n-*.md
§ "Tranche X"`) and a phase marker (`RED first` / `sweep` /
   `verify`).
4. Keep the detection logic if it uses loose proxies (file existence,
   negative grep). Replace tight symbol greps with file-existence
   checks where possible.
5. Verify: `bash goals/n-*.next-task.sh` still dispatches sensibly
   from a clean checkout.

Each goal's next-task trim is a small change and can land alongside
its gates.sh trim in the same PR.

## Open question

Should there be a `lint:harness` job that runs over all
`goals/*.gates.sh` and `goals/*.next-task.sh` and flags suspicious
patterns (function-body token greps, test-title strings in heredocs,
specific file path enforcement)? This would automate the trim audit
and prevent regression.

Not in scope for goal 30. Queued here.
