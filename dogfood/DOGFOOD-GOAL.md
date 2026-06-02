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

Only one variable is required:

    export VSPEC_DOGFOOD_REPO=<path to the separate dogfood repo, outside this monorepo>

Everything else is automatic: provision builds the local vspec, installs it
globally, auto-boots a stub-enabled in-memory API at `http://127.0.0.1:8799`
(no Postgres), and seeds an authenticated session into the repo's
`.vspec/config.json`. To point at a remote API instead, set
`VSPEC_DOGFOOD_API_URL` (and provide auth via `VSPEC_DOGFOOD_SESSION_COOKIE`
or `VSPEC_DOGFOOD_PROVISION_HOOK`). Full knob list: `docs/dogfood-loop.md`
§ "예산/제어 env".

## Invariants

- The dogfood loop never edits the product directly. Its only product-facing
  output is **findings** (`docs/findings/<ts>-dogfood-*.md`) and **goal trios**
  (`goals/`). The build loop implements them under the normal gate/rigor regime.
- Spawned goals route per the existing rule: presentation root-cause
  (`apps/app`, `apps/www`) → claude-owned (`## Delegation`); everything else →
  codex TDD.
- Clean pass = P0+P1 == 0. P2 findings are recorded as debt but do not keep the
  loop running.
