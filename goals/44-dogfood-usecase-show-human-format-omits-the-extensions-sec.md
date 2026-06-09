# Goal 44 -- `usecase show` (human format) must render the Extensions section at parity with agent/json

> An agent taking this goal active must first read
> `guidelines/goal-iteration.md` for the iteration protocol.

## Mission

When an agent runs `vspec usecase show <id>` (the default human format), the
output must show the use case's **Extensions** at full parity with
`--format=agent`, `--format=json`, and the markdown export. First-class
extensions are a documented Cockburn-fidelity element: each extension carries an
extension point, a condition, an optional outcome (`FAILURE` / `PARTIAL` /
`SUCCESS`), and zero or more recovery steps. Today the human view drops them.

The data is stored correctly and the structured formats already carry it -- the
agent envelope and the json body serialize every scenario field (the show data
scenario schema is a `looseObject`, so `outcome` passes through), and the
markdown export renders it. Only the human presentation layer
(`printUsecaseShow` in `apps/cli/src/commands/usecase-output.ts`) drops it. This
is a CLI presentation fix, not a data fix.

## Why This Goal Exists

This resolves
`docs/findings/2026-06-04T1811-dogfood-20260604T180511Z-df-006-usecase-show-human-format-omits-the-extensi.md`
(case `DF-006`, P1). During the dogfood loop (cycle `20260604T180511Z`) the
agent ran `vspec usecase show TODO-001 | head -60` (command 26), saw the Main
Success Scenario but no extension, then had to grep the `--format=agent` payload
(command 27) for `EXTENSION` / `condition` / `Title is empty` / `FAILURE` / `2a`
to confirm the extension had even been stored. Narration line 89: "The main
scenario shows but not the extension." Line 105: "`usecase show` (human format)
omits the Extensions section -- I only confirmed the extension was stored via
`--format=agent` and the markdown export."

Root cause: `printUsecaseShow` in `apps/cli/src/commands/usecase-output.ts`
gates the entire Extensions block behind
`extensions.some((scenario) => scenario.steps.length > 0)` and its inner loop
emits only the condition line and step lines. Consequences:

1. A **condition-only extension** (an extension point + condition + outcome with
   no recovery steps -- e.g. `2a. Title is empty -> FAILURE`) is dropped
   entirely, because no extension in the use case satisfies the `steps > 0`
   guard. This is exactly the `TODO-001` extension the dogfood agent could not
   see.
2. The **outcome** (`FAILURE` / `PARTIAL` / `SUCCESS`) is never rendered in any
   case, even for extensions that do have steps. `printUsecaseShow` has no
   reference to `outcome` at all.

So the human view silently diverges from the agent / json / markdown views.

## Completion Conditions

1. `vspec usecase show <id>` in the **human** format renders the Extensions
   section whenever the use case has **at least one** EXTENSION scenario --
   including extensions that have **no recovery steps**. The section is no longer
   gated on any extension having steps.
2. For **every** EXTENSION scenario the use case carries, the human output
   renders that scenario's first-class Cockburn extension element set:
   - its **extension point** (e.g. `2a`),
   - its **condition** (e.g. `Title is empty`), and
   - its **outcome** when present (one of `FAILURE` / `PARTIAL` / `SUCCESS`).
   Recovery **steps** continue to render, exactly as before, when present. No
   extension is silently dropped.
3. Format parity holds: for **every** output format `usecase show` accepts
   (`human`, `json`, `agent`), the extension data is present in the rendered
   output. `json` and `agent` already serialize the raw scenarios; `human` now
   reaches parity. No accepted format degrades to a bare banner or a section that
   silently omits stored extensions. The set of accepted formats is the
   whitelist in `usecase-flags.ts` (`["agent", "human", "json"]`), and the show
   command (`showUsecase` in `apps/cli/src/commands/usecase.ts`) routes each one
   to a renderer -- none falls through to an empty default.
4. The CLI typechecks, the new human-extension-parity behavior is locked by unit
   tests against `printUsecaseShow` (covering: a condition-only extension with an
   outcome and no steps, an extension with steps, and the rendered outcome
   token), and the existing `usecase` output suite
   (`apps/cli/tests/unit/usecase-output.test.ts`) stays green.

## Sources Of Truth

- `docs/findings/2026-06-04T1811-dogfood-20260604T180511Z-df-006-usecase-show-human-format-omits-the-extensi.md`
- `apps/cli/src/commands/usecase-output.ts` (the `printUsecaseShow` human renderer)
- `apps/cli/src/commands/usecase.ts` (`showUsecase` format dispatch)
- `apps/cli/src/commands/usecase-flags.ts` (the accepted-format whitelist)
- `packages/contracts/src/scenario.ts` (`scenarioOutcomeSchema` -- the outcome
  enum that is a first-class Cockburn extension element)
- `apps/cli/tests/unit/usecase-show-extensions.test.ts` (new behavior lock)
- `apps/cli/tests/unit/usecase-output.test.ts` (existing suite that must stay green)

The set of accepted output formats is enumerated from source with the
`includes(format)` whitelist line in `apps/cli/src/commands/usecase-flags.ts`;
the gate loops over each format and confirms the show command routes it rather
than dropping it. Every Cockburn extension element (extension point, condition,
outcome) reaching the human view is locked by the behavior test, not by grepping
the renderer body.

## Verification

```
pnpm --filter @vooster/cli typecheck
pnpm exec vitest run apps/cli/tests/unit/usecase-show-extensions.test.ts apps/cli/tests/unit/usecase-output.test.ts
bash goals/44-dogfood-usecase-show-human-format-omits-the-extensions-sec.gates.sh
bash scripts/completion-check.sh
```
