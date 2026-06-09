---
case_id: DF-005
severity: P1
resolved: true
---

# Goal 64: Dogfood Finding Follow-Up

> 이 goal을 active로 잡은 에이전트는 먼저
> `guidelines/goal-iteration.md`를 읽어 iteration 프로토콜을 확인할 것.

Resolve the dogfood finding **No way to list or read-only inspect archived use
cases; agent guessed nonexistent flags and mutated state to investigate**.

The finding is recorded inline in this file (see _Source finding_ below); the
`resolved:` flag in the frontmatter above is the structural anchor that
`64-...gates.sh` reads. Flip it to `true` only after the fix lands with test
evidence.

Root-cause area: `apps/cli/src/commands` (`usecase list` has no archived
filter; `usecase show` cannot read an archived spec) and `apps/api/src/http`
(no read path exposes archived use cases).

## Source finding

To find and inspect the archived POCKET-006, the agent guessed
`vspec usecase list --all` and `vspec usecase list --archived` — both rejected
with `Error: Nonexistent flag: --all` / `--archived`, each followed by a
misleading second line `Error: Command usecase not found.`. With no read path
to an archived spec, the agent ran `vspec usecase restore POCKET-006` purely to
read it, then re-archived it — mutating synced state during a read-only
investigation (its own narration: "I briefly restored it during investigation
to read it, then re-archived it").

Inspecting an archived spec must never require a `restore` round-trip, and an
unknown flag must not emit a confusing dual `Nonexistent flag` +
`Command … not found` error.

## Completion

A. The source finding is resolved: the `resolved:` frontmatter flag in this
file is set to `true` after the implementation addresses every clause of the
recommendation below.

B. The implementation is verified with the smallest relevant tests or dogfood
rerun, and this file records that evidence in a _Verification_ section.

## Recommendation

There are three independent clauses; the fix must cover all three so no
read-only inspection of an archived spec ever needs a state mutation:

1. **List filter** — `vspec usecase list` accepts a flag that includes archived
   use cases (e.g. `--archived` to show only archived, or `--all` to show both
   active and archived), and archived entries are visually distinguished from
   active ones. The default (no flag) scope is unchanged.
2. **Read path** — `vspec usecase show <KEY>` renders an archived use case
   read-only, so an archived spec can be inspected without restoring it. The
   output makes the archived state explicit.
3. **Honest unknown-flag error** — an unknown flag on a `usecase` subcommand
   produces a single, accurate error naming the bad flag, with no spurious
   `Command … not found.` second line.

Per rubric principle, no read-only operation may force the agent to mutate
synced state, and an error message must not mislead the agent into guessing
(`docs/06-api-contract.md`, `docs/07-cli-spec.md`).

## Verification

- RED: `pnpm exec vitest run apps/api/tests/e2e/UC-014.test.ts apps/api/tests/e2e/UC-034.test.ts apps/cli/tests/e2e-cli/UC-015.test.ts`
  failed because archived list scopes were ignored, archived show returned 404,
  and unknown flags emitted `Command usecase not found`.
- GREEN: the same targeted Vitest command passes.
- Typecheck: `pnpm exec tsc -p tsconfig.json --noEmit` passes.
- Lint: `pnpm exec eslint . --max-warnings 0` passes.
