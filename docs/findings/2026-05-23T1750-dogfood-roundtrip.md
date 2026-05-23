---
title: "Close the dogfood round-trip: A1 + A3 + A10 + A11"
created_at: 2026-05-23T17:50:00Z
priority: P0
resolved: true
resolved_by:
  - 80dfec9
  - 17e07f0
  - 2d2681c
  - b31564b
  - f9ebabe
  - 6449271
  - c6869cf
was: goals/30-dogfood-roundtrip.md
related:
  - docs/findings/2026-05-22T1632-dogfood-snapshot.md
  - docs/findings/2026-05-23T1700-dogfood-followups.md
  - docs/findings/2026-05-23T1700-gates-over-coupling.md
  - docs/findings/2026-05-23T1745-build-dedup.md
---

# Findings — close the dogfood round-trip (A1 + A3 + A10 + A11)

_Originally drafted 2026-05-23 as `goals/30-dogfood-roundtrip.md`.
Converted to findings the same day after the session realized the
goal was design-only — gate teeth were minimal (followups doc exists +
rigor), behavior enforcement lived in tests that weren't yet written.
A goal that doesn't enforce its claims at the gate layer is honestly a
findings doc with priority. Promote back to `goals/` when ready to
TDD-execute with real behavioral test contracts._

## Why this matters

The 2026-05-23 dogfood
([snapshot](./2026-05-22T1632-dogfood-snapshot.md)) showed the CLI
cannot register and edit vspec's own 35 use cases inside vspec — the
dogfood promise from `docs/00-overview.md`. Four bugs together break
the round trip:

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
- **A11** `vspec init --project <KEY>` writes only
  `current_project_key` to `.vspec/config.json` — no project id, no
  api url, no workspace id — so the very next command has no usable
  handle.

After this work: an agent runs `vspec init --project VSPEC`, then
`vspec pull`, then `vspec usecase show VSPEC-001`, then `vspec push` —
with no `--project-id` flag anywhere — and the round-trip preserves
the full use case body (stakeholders, scenarios, steps, extensions).

## Behavioral invariants to land

Each invariant is verified by a test under `apps/api/tests/` or
`apps/cli/tests/`. Tests are the brake; this list is the contract.

- **B1.** `pullSyncFiles` returns the same body sections that
  `vspec export markdown` produces (`## Stakeholders and Interests`,
  `## Preconditions`, `## Trigger`, `## Main Success Scenario`,
  `## Extensions`, `## Success Guarantee`, `## Minimal Guarantee`,
  `## Notes`), populated from the seeded stakeholder name, step actor
  name, and step action text.
- **B2.** `printUsecaseShow` (`apps/cli/src/commands/usecase-output.ts`)
  renders stakeholders, the main-success scenario steps, and
  extensions for a use case that has them — not just key, title,
  status, revision.
- **B3.** `resolveContextFlag` (`apps/cli/src/flag-values.ts`)
  resolves `"project-id"` from `current_project_id` in
  `~/.vspec/config.json` or `.vspec/config.json` when the flag is not
  passed. The flag still wins when both are present. An informative
  error fires when neither source has a value.
- **B4.** `runInit` (`apps/cli/src/commands/init.ts`) resolves the
  project key against `/v1/projects/<key>` and writes
  `current_project_id`, `current_project_key`, `api_url`, and
  `current_workspace_id` to the local `.vspec/config.json`. An
  unknown key surfaces as a `CLIError` that names the key.
- **B5.** After `runCli(["init", "--project", "<KEY>"])` and
  `runCli(["pull"])`, the file `specs/<KEY>-NNN.md` contains the
  rendered body. After `runCli(["usecase", "show", "<KEY>-NNN"])`,
  stdout contains the same stakeholder and step text. **No
  `--project-id` flag is passed at any step.**

## Suggested test locations

Any equivalent placement is fine; these are just defaults.

```
apps/api/tests/{integration,unit/application}/sync-pull-roundtrip.test.ts
apps/cli/tests/unit/usecase-show-human-body.test.ts
apps/cli/tests/unit/resolve-project-id-config.test.ts
apps/cli/tests/e2e-cli/init-persists-project-context.test.ts
apps/cli/tests/e2e-cli/dogfood-roundtrip.test.ts
```

## Recommended execution order (TDD)

1. Author / verify the deferred dogfood follow-ups tracker exists
   ([2026-05-23T1700-dogfood-followups.md](./2026-05-23T1700-dogfood-followups.md)).
2. RED unit test for `resolveContextFlag` `project-id` fall-through;
   GREEN by widening the union and the config map.
3. Sweep callers that still pass `--project-id` manually through
   `requiredFlag` to use the new arm. Negative invariant: zero
   matches for
   `grep -rE 'requiredFlag\([^)]*,\s*"project-id"\)' apps/cli/src`.
4. RED E2E for `runInit` persistence (success + unknown-key); GREEN
   by resolving the project key against the API and writing the four
   fields.
5. RED round-trip test for `pullSyncFiles`; GREEN by swapping in
   `renderMarkdown`.
6. RED unit test for `printUsecaseShow` body sections; GREEN by
   walking the response shape.
7. RED end-to-end dogfood round-trip with no `--project-id`; GREEN by
   wiring the above together.

## Scope guards (when promoting back to a goal)

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

## Why this is a findings doc, not a goal

Per `docs/goal-design.md §1.5`, a gate should enforce universal
claims that no other tool catches. The behavioral invariants above
are all verified by tests (vitest + typecheck). A `goals/30-*.gates.sh`
that grep-matched specific symbols would be over-coupled. A
`goals/30-*.gates.sh` that _only_ enforced "followups doc exists +
rigor" doesn't carry the actual work.

So: track the work here, write the tests when execution starts, and
either:

- Promote back to a goal with **deduplicated** gates (e.g. "no caller
  hard-requires `--project-id`" — a negative universal invariant)
  when there's something gate-shaped to enforce, or
- Just close this doc when the tests are green and the dogfood loop
  works.

This is more honest than a goal whose gates pass independently of
whether the work is done.

## Estimate

Half day to a full day of TDD work, given the tests above. Smaller
than it looks because A10 + A11 are config-store work (small) and the
A1 + A3 renderers reuse `renderMarkdown` (also small once
`pullSyncFiles` takes the wider dependency set).

## Resolution

Resolved on 2026-05-23.

- B1: `pullSyncFiles` now delegates to the canonical markdown renderer and
  `sync-files.test.ts` asserts the exported stakeholder, scenario, extension,
  guarantee, and notes sections.
- B2: `usecase show` now returns and prints stakeholder interests, main-success
  steps, and extensions; API and CLI unit tests cover the human-readable body.
- B3: `resolveContextFlag` resolves `project-id` from `current_project_id`, and
  CLI project-scoped callers no longer hard-require `--project-id`.
- B4: `vspec init --project <KEY>` resolves the key through `/v1/projects` and
  writes `current_project_id`, `current_project_key`, `api_url`, and
  `current_workspace_id`; Goal 7 gates now seed authenticated project context.
- B5: `dogfood-roundtrip.test.ts` proves `init -> pull -> usecase show` works
  from an isolated repo without passing `--project-id`, and the pulled file plus
  show output contain the same stakeholder and step text.

Verification: `bash scripts/completion-check.sh` passed after the resolution.
