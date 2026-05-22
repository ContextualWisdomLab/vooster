# Goal 30: Dogfood Round-Trip Closes

> 이 goal을 active로 잡은 에이전트는 먼저
> `guidelines/goal-iteration.md`를 읽어 iteration 프로토콜을 확인할 것.

## Why This Goal Exists

The 2026-05-23 dogfood (`docs/findings/2026-05-22T1632-dogfood-snapshot.md`) showed
that the CLI cannot register and edit vspec's own 35 use cases inside
vspec — the dogfood promise from `docs/00-overview.md`. Four bugs
together break the round trip:

- **A1** `vspec pull` strips each use case down to frontmatter + title
  (`apps/api/src/application/sync-files.ts:281` ships a duplicate
  `usecaseMarkdown` that bypasses the full renderer used by
  `vspec export markdown`).
- **A3** `vspec usecase show` prints 4 lines for a use case that has
  stakeholders, scenarios, and steps in the API payload
  (`apps/cli/src/commands/usecase-output.ts:136-144`).
- **A10** `resolveContextFlag` reads `api-url`, `session-cookie`, and
  `workspace-id` from `~/.vspec/config.json` but not `project-id`, so a
  project-scoped command demands `--project-id <UUID>` after
  `init`/`switch`.
- **A11** `vspec init --project <KEY>` writes only `current_project_key`
  to `.vspec/config.json` — no project id, no api url, no workspace id
  — so the very next command has no usable handle.

After this goal: an agent runs `vspec init --project VSPEC`, then
`vspec pull`, then `vspec usecase show VSPEC-001`, then `vspec push`
— with no `--project-id` flag anywhere — and the round-trip preserves
the full use case body (stakeholders, scenarios, steps, extensions).

Out-of-scope dogfood findings (A2 doctor 404, A4 status panel, A5
self-teaching errors, A6 `--help` / `help <cmd>`, A7 phantom session
file, A8 `project switch` desync, A9 login project context, A12 signup
Prisma 500, A13 verb-phrase regex, A14 missing verbs, A15 `usecase set`
audit, B1–B6 spec mismatches, H1–H3 cross-cutting hazards) are queued
in `docs/findings/2026-05-23T1700-dogfood-followups.md` for later goals.

## Self-Audit (per `docs/goal-design.md §5`)

Additive — no prior goal invariant is loosened.

- Goal 26 (`pull-sync-agent-format`) declares the agent envelope shape
  on `vspec pull`. Swapping the sync-pull renderer for the shared
  `renderMarkdown` strengthens that gate by making the body real.
- Goals 7 / 9 / 10 enumerate `--format=agent` coverage in CLI command
  files. This goal does not touch those branches.
- Adding a `project-id` arm to `resolveContextFlag` is additive: the
  existing `--project-id <UUID>` flag path still works.
- `vspec init` persistence widens from one field to four; no command
  that reads `.vspec/config.json` is broken by additional fields.
- No `## Supersedes` section is required.

## Why this gate suite is short

Behavior is verified by tests (run by goal-0's `vitest run --coverage`
gate) and `typecheck`. This file's gates only enforce what no other
tool can:

- The **rigor mechanism** from `goal-design.md §1`.
- The **followups doc exists** so deferred dogfood work is not lost.

Per-function token grep, type-shape grep, test-title grep, and similar
were intentionally dropped. See
`docs/findings/2026-05-23T1700-gates-over-coupling.md` for the broader
cleanup queue.

## The Goal

### Tranche A — Followups Doc

The file `docs/findings/2026-05-23T1700-dogfood-followups.md` exists and:

- Lists the deferred dogfood IDs (A2, A4–A9, A12–A15, B1–B6, H1–H3) so
  a later goal can pick them up by name.
- Does not list A1, A3, A10, A11 as open (those are closed by this
  goal).
- References `docs/findings/2026-05-22T1632-dogfood-snapshot.md` so future agents
  can recover full context.

The gate only checks file existence. The doc's structure is reviewed
by humans at PR time — `check-gate-rigor.sh` already covers the
universal-claim invariant separately.

### Tranche B — Behavior (verified by tests)

The following invariants hold. Each is verified by a test under
`apps/api/tests/` or `apps/cli/tests/`. Goal-0's vitest gate fails if
any test fails; typecheck fails if a type shape is wrong. This file
does not re-verify those.

- B1. `pullSyncFiles` returns the same body sections that
  `vspec export markdown` produces (`## Stakeholders and Interests`,
  `## Preconditions`, `## Trigger`, `## Main Success Scenario`,
  `## Extensions`, `## Success Guarantee`, `## Minimal Guarantee`,
  `## Notes`), populated from the seeded stakeholder name, step actor
  name, and step action text.
- B2. `printUsecaseShow` (`apps/cli/src/commands/usecase-output.ts`)
  renders stakeholders, the main-success scenario steps, and
  extensions for a use case that has them — not just key, title,
  status, revision.
- B3. `resolveContextFlag` (`apps/cli/src/flag-values.ts`) resolves
  `"project-id"` from `current_project_id` in `~/.vspec/config.json`
  or `.vspec/config.json` when the flag is not passed. The flag still
  wins when both are present. An informative error fires when neither
  source has a value.
- B4. `runInit` (`apps/cli/src/commands/init.ts`) resolves the project
  key against `/v1/projects/<key>` and writes `current_project_id`,
  `current_project_key`, `api_url`, and `current_workspace_id` to the
  local `.vspec/config.json`. An unknown key surfaces as a `CLIError`
  that names the key.
- B5. After `runCli(["init", "--project", "<KEY>"])` and
  `runCli(["pull"])`, the file `specs/<KEY>-NNN.md` contains the
  rendered body. After `runCli(["usecase", "show", "<KEY>-NNN"])`,
  stdout contains the same stakeholder and step text. **No
  `--project-id` flag is passed at any step.**

Suggested test locations (any equivalent placement is fine; the gate
does not enforce paths):

```
apps/api/tests/{integration,unit/application}/sync-pull-roundtrip.test.ts
apps/cli/tests/unit/usecase-show-human-body.test.ts
apps/cli/tests/unit/resolve-project-id-config.test.ts
apps/cli/tests/e2e-cli/init-persists-project-context.test.ts
apps/cli/tests/e2e-cli/dogfood-roundtrip.test.ts
```

### Tranche G — Rigor

`scripts/check-gate-rigor.sh goals/30-dogfood-roundtrip.md` passes.

## Scope Guards

- No `vspec doctor` route work (A2 stays queued).
- No `vspec status` redesign (A4 stays queued).
- No CLI help system overhaul (A6 stays queued).
- No `vspec project switch` / `login` context refresh (A8, A9 stay
  queued).
- No verb-phrase regex change (A13 stays queued).
- No new missing-verb routing (A14 stays queued).
- No `ai-guide` rewrite (B3 stays queued).
- No `~/.vspec/config.json` test isolation change (H1 stays queued).
- No CLI dispatcher refactor (H2 stays queued).
- The original `docs/findings/2026-05-22T1632-dogfood-snapshot.md` is treated as a
  historical snapshot — it is not edited by this goal.
- No prior goal gate may be weakened to pass this goal.

## Recommended Order

1. Author `docs/findings/2026-05-23T1700-dogfood-followups.md` so the
   deferred queue is visible from iteration 1.
2. RED unit test for `resolveContextFlag` `project-id` fall-through;
   GREEN by widening the union and the config map.
3. Sweep callers that still pass `--project-id` manually through
   `requiredFlag` to use the new arm.
4. RED E2E for `runInit` persistence (success + unknown-key); GREEN by
   resolving the project key against the API and writing the four
   fields.
5. RED round-trip test for `pullSyncFiles`; GREEN by swapping in
   `renderMarkdown`.
6. RED unit test for `printUsecaseShow` body sections; GREEN by walking
   the response shape.
7. RED end-to-end dogfood round-trip with no `--project-id`; GREEN by
   wiring the above together.
8. `bash goals/30-dogfood-roundtrip.gates.sh` and
   `bash scripts/active-check.sh`.
