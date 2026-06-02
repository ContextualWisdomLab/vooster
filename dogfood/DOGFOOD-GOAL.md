# Codex Goal: Dogfood vspec until clean

> This is a **standalone codex goal**, intentionally NOT in the `goals/` build
> stack (it is independent of build progress). Full design:
> `docs/dogfood-loop.md`. It exercises the shipped product as an ICP agent
> would, finds friction, and feeds the build stack new goals — it does not
> itself build the product.

## The Goal

Drive the dogfood loop until a full pass of `dogfood/cases/*.md` produces **zero
P0 and zero P1 findings**. Each iteration runs every ICP case against the
shipped product, analyzes the sessions, and — if real friction is found —
records findings and spawns improvement goals for the build loop to implement.

## The entrypoint (every iteration)

    bash scripts/dogfood/dogfood-cycle.sh

Interpret its exit code:

| exit | meaning                                                         | your next action                                                                                                                                                                     |
| ---- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 0    | clean pass — no P0/P1 across all cases                          | **STOP.** The goal is met.                                                                                                                                                           |
| 2    | findings written + improvement goals spawned into `goals/`      | run the build loop (`scripts/completion-check.sh` → drive each active goal green per `docs/goal-design.md`) until `.state/active-goal` is `ALL_DONE`, then re-run `dogfood-cycle.sh` |
| 1    | hard error (provision failed, claude is_error, missing tooling) | inspect, fix the harness, do not loop blindly                                                                                                                                        |
| 3    | cycle/budget cap hit                                            | a blocker was appended to `docs/state/blockers.md`; stop and escalate                                                                                                                |

## Required environment

`VSPEC_DOGFOOD_REPO` must point at the separate dogfood codebase (outside this
monorepo). See `docs/dogfood-loop.md` § "예산/제어 env" for the full knob list
(`VSPEC_DOGFOOD_BUDGET_USD`, `VSPEC_DOGFOOD_MAX_CYCLES`, `VSPEC_DOGFOOD_LINK`, …).

## Invariants

- The dogfood loop never edits the product directly. Its only product-facing
  output is **findings** (`docs/findings/<ts>-dogfood-*.md`) and **goal trios**
  (`goals/`). The build loop implements them under the normal gate/rigor regime.
- Spawned goals route per the existing rule: presentation root-cause
  (`apps/app`, `apps/www`) → claude-owned (`## Delegation`); everything else →
  codex TDD.
- Clean pass = P0+P1 == 0. P2 findings are recorded as debt but do not keep the
  loop running.
