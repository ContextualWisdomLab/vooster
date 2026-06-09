# Goal 72 -- a successful `vspec scenario add --format=agent` must surface the new scenario id in a concrete `vspec step add <id> …` next action; placeholders are not allowed

> An agent taking this goal active must first read
> `guidelines/goal-iteration.md` for the iteration protocol.

## Mission

`vspec scenario add TODO-001 --type MAIN_SUCCESS --outcome SUCCESS --format=agent`
created the scenario and returned `scenario` + `revision` + `steps`, but it never
told the agent the one thing it needed next: the **id of the scenario it just
created**. The very next documented step is `vspec step add <main-scenario-id>
…`, but the create response carried no `suggested_next_actions` at all, and the
guide's examples used the literal placeholder `<main-scenario-id>`. The dogfood
agent could not template the command, so it fell back to grepping
`vspec usecase show TODO-001 --format=agent | python3 … data['scenarios'][].id`
— running `vspec usecase show` six times to dig the id back out of JSON. Its own
narration: *"Step adds need a scenario id, not the use-case key. … neither
usecase create nor scenario add's tail output surfaced that id clearly. … echoing
the new scenario id prominently on scenario add would close that gap."*

The root cause is the API success path. `sendCreateScenarioResult`'s `CREATED`
branch in `apps/api/src/http/scenario-results.ts` sends `scenario`/`revision`/
`steps` but attaches **no** `suggested_next_actions`. The `duplicateMainSuccess`
error path in `apps/api/src/http/scenario-support.ts:92` emits a bare
`command: "vspec step add"` with no id, and the guide
(`apps/api/src/application/ai-guide.ts:94/181`) only ever shows the literal
`<main-scenario-id>` placeholder. Nowhere does the real id reach the agent
already templated into the next command.

One thing must become true:

1. **Every successful `scenario add` (the `CREATED` 201 path), for every scenario
   type that `scenario add` can create, must surface the new scenario's real id
   in a `suggested_next_actions` entry whose `command` is a concrete
   `vspec step add <that scenario's real id> …` — with the actual created id
   templated in, never a `<…>` angle-bracket placeholder.** This is the universal
   claim of this goal: the gate enumerates the scenario-type enum from the
   contracts source of truth and, for each type, drives the **real**
   `sendCreateScenarioResult` over a freshly created scenario with a known id,
   asserting the sent envelope hands back a `vspec step add` next action carrying
   that exact id. No single-case cheat.

The CLI human surface already leads with the id — `printScenario` in
`apps/cli/src/commands/scenario.ts` prints `Scenario <id>` as its first line —
so that line must stay. The binding contract of this goal is the agent surface:
the `--format=agent` JSON that reaches the agent, which is the API create
response. Surfacing the id in `suggested_next_actions` is the machine-readable
fix the agent narration asked for.

## Why This Goal Exists

This resolves the DF-006 finding recorded in the dogfood loop. The agent ran
`vspec scenario add … --format=agent` and then `vspec usecase show TODO-001
--format=agent | python3 …` repeatedly (subcommand frequency: `6 vspec usecase
show`) purely to recover the scenario id that `scenario add` should have echoed.
The new scenario id is the single datum needed to chain into `step add`; not
surfacing it forces a JSON-spelunking detour and breaks the documented
create → step-add flow.

This is additive to the existing `suggested_next_actions` machinery already used
across the create/error envelopes (`problem(...)`'s fourth argument, the
`missingStakeholderInterestProblem` / `parentStepOutOfRangeProblem` next-action
lists in `scenario-results.ts`). It extends that discipline to the scenario
**success** path. It does not weaken any prior gate.

## Completion Conditions

1. **Every scenario type the contracts enum declares yields a real-id step-add
   next action on create.** The source of truth is `scenarioTypeSchema =
   z.enum([...])` in `packages/contracts/src/scenario.ts`. This is a universal
   claim: the gate enumerates every enum member from that line and, for each,
   drives the **real** `sendCreateScenarioResult` (from
   `apps/api/src/http/scenario-results.ts`) over a `CREATED` result whose
   `scenario.id` is a known sentinel, captures the sent body, and asserts (a) the
   body carries a `suggested_next_actions` array with a `vspec step add …`
   command, (b) that command contains the exact sentinel id (the real id is
   templated in), and (c) that command contains no `<…>` placeholder. The
   dogfood anchor type `MAIN_SUCCESS` must be among the enumerated members and
   the enum must declare at least 2 types — no single-case cheat. Future dogfood
   findings of the same shape extend the contracts enum / the response builder
   rather than re-opening per-type handling.
2. **The scenario-results behaviour is locked by unit tests.** The exact next-
   action wording, the templated id, and the unchanged happy-path shape (the
   create response still validates against `scenarioCreateResponseSchema` and the
   error/duplicate paths are unaffected) are pinned by
   `apps/api/tests/unit/http/scenario-results.test.ts`.
3. The API typechecks (the `suggested_next_actions` field must be carried through
   `scenarioCreateResponseSchema` so the parsed response does not strip it) and
   the targeted behaviour suite passes.

## Sources Of Truth

- The dogfood finding for DF-006 (`scenario add` does not surface the new
  scenario id for the next `step add`).
- `packages/contracts/src/scenario.ts` (`scenarioTypeSchema` — the enumerated
  scenario types; `scenarioCreateResponseSchema` — the create response shape that
  must carry `suggested_next_actions`).
- `apps/api/src/http/scenario-results.ts` (`sendCreateScenarioResult`, the
  `CREATED` branch that must attach the step-add next action).
- `apps/api/src/http/scenario-support.ts` (`duplicateMainSuccessProblem`'s bare
  `vspec step add` next action; the existing next-action helpers to reuse).
- `apps/cli/src/commands/scenario.ts` (`printScenario` already leads with
  `Scenario <id>` — keep it).
- `apps/api/tests/unit/http/scenario-results.test.ts`.

The scenario types are enumerated from source by extracting the quoted members of
`scenarioTypeSchema = z.enum([...])`; the gate loops the real
`sendCreateScenarioResult` over each type against a `CREATED` result with a
sentinel id and asserts the real id reaches the agent inside a `vspec step add`
next action. The dogfood anchor type (`MAIN_SUCCESS`) must be present so the
enumeration genuinely encodes the regression.

## Verification

```
pnpm --filter @vooster/api typecheck
pnpm exec vitest run apps/api/tests/unit/http/scenario-results.test.ts
bash goals/72-dogfood-scenario-add-does-not-surface-the-new-scenario-id-.gates.sh
bash scripts/completion-check.sh
```
