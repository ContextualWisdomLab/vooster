---
case_id: DF-006
severity: P1
resolved: true
---

# Goal 66: Dogfood Finding Follow-Up

> 이 goal을 active로 잡은 에이전트는 먼저
> `guidelines/goal-iteration.md`를 읽어 iteration 프로토콜을 확인할 것.

Resolve the dogfood finding **`vspec sync` leaves the local spec file pinned at
the create revision after server-side mutations (the on-disk file lags the
server, forcing an `export > file` fallback)**.

The finding is recorded inline in this file (see _Source finding_ below); the
`resolved:` flag in the frontmatter above is the structural anchor that
`66-...gates.sh` reads. Flip it to `true` only after the fix lands with test
evidence.

Root-cause area: `apps/cli/src/commands/sync.ts`,
`apps/cli/src/commands/sync-files.ts`, and the API mutation responses'
`affected_files` in `apps/api/src/http/*` (scenario/step routes).

## Source finding

While dogfooding, step and scenario mutations returned an empty
`affected_files` and did not rewrite `specs/TODO-001.md`. `vspec sync` then
stayed pinned to the revision recorded at create time, so the on-disk file
lagged the server: `vspec sync … | tail -8` (cmd 21) did not bring the file
current, even though `usecase show` (cmd 19) against the server was always
correct. The agent had to fall back to
`vspec export markdown TODO-001 > specs/TODO-001.md` (cmd 23) to make the repo
reflect reality. A `sync` that does not reconcile the local file to the latest
server revision silently leaves the repository stale — the exact data-integrity
failure the command exists to prevent.

## Completion

A. The source finding is resolved: the `resolved:` frontmatter flag in this
file is set to `true` after the implementation addresses the recommendation
below.

B. The implementation is verified with the smallest relevant test or dogfood
rerun, and this file records that evidence in a _Verification_ section.

## Recommendation

`vspec sync` must reconcile the local spec file to the **latest** server
revision, not the revision recorded at create time. Either populate
`affected_files` on every scenario/step mutation response so the local file is
rewritten incrementally, or have `sync` re-pull and re-render the current
revision before writing. After a server-side mutation, a plain `vspec sync`
must leave the on-disk spec file byte-identical to what
`vspec export markdown <KEY>` would produce — there must be no need for an
`export > file` fallback to keep the repo current.

This reconciliation must hold for **every** mutation kind that changes a
rendered spec (at minimum: scenario add/edit and step add/edit) — the fix must
not bring the file current for one mutation kind while leaving another pinned
at the stale revision. A mutation that does not change rendered output may
legitimately leave the file unchanged, but no rendered-output-changing mutation
may leave `sync` stale.

## Verification

- Added red coverage for sync pull after server-side scenario create, step add,
  step edit, and step move revision advancement. There is no scenario edit
  command implemented yet.
- `pnpm exec vitest run apps/api/tests/unit/application/scenario-authoring.test.ts apps/api/tests/unit/application/scenario-step-positioning.test.ts apps/api/tests/unit/application/step-editing.test.ts apps/api/tests/e2e/UC-029.test.ts`
- `pnpm exec tsc -p tsconfig.json --noEmit`
- `pnpm exec eslint . --max-warnings 0`
