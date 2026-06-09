# Goal 71 -- `vspec actor` read commands must never leak a raw `ApiError` class string; an unresolved actor returns a self-teaching envelope

> An agent taking this goal active must first read
> `guidelines/goal-iteration.md` for the iteration protocol.

## Mission

`vspec actor show "Account Holder"` (and `"Pocket"`/`"Partner"`) printed the bare
internal error-class string `ApiError: API request failed with 404.` and exited
1, immediately after `vspec actor list` had successfully returned those actors
with their names, types, and ids. The CLI surfaced no stable `code`, no message
explaining that `actor show` resolves by **id** (not display name), and no
`suggested_next_actions` pointing back at the id `actor list` had just printed.
The dogfood agent could not recover and abandoned per-actor inspection.

The root cause is in the CLI: `showActor`/`editActor`/`archiveActor`/`listActors`
in `apps/cli/src/commands/actor.ts` call `fetchJson`/`patchJson`/`deleteJson`
directly and never catch `ApiError`. On any non-2xx response the raw `ApiError`
propagates to oclif's top-level handler, which stringifies the error class to
stdout/stderr. (`vspec actor create` already routes through
`runMutationCommand` → `runMutation`, which catches `ApiError` and emits the
documented envelope — so the read/by-id commands are the gap.)

Two things must become true:

1. **No `vspec actor` command may ever let a raw `ApiError: …` class string reach
   stdout/stderr.** Every actor command that talks to the API must translate an
   API failure into the documented agent error envelope (a stable `code` from the
   shared error-code set, plus a human-readable message). This is the universal
   claim of this goal.
2. **An unresolved actor must be self-teaching.** When `actor show`/`edit`/`archive`
   cannot resolve the supplied actor, the envelope's message must name the lookup
   key the agent passed, and `suggested_next_actions` must point the agent at
   `vspec actor list` so it can retry with the listed id (the fix for the
   "resolves by id, not display name" confusion). `--force`-style escape hatches
   are irrelevant here; the agent must simply be handed the next action.

The API may additionally enrich its 404 Problem Details, but the binding contract
of this goal is the CLI surface: what reaches the user's terminal.

## Why This Goal Exists

This resolves the DF-005 facet recorded in the dogfood loop: `vspec actor show
"Account Holder"` returned `Exit code 1` and `ApiError: API request failed with
404.` with no `code`, no key-naming message, and no `suggested_next_actions`,
right after `vspec actor list` had listed `Account Holder PRIMARY f9210548-…`.
The bare error-class string is a self-teaching failure: the agent built the wrong
mental model and fell back to `actor list` instead of inspecting actors.

This is additive to the existing envelope machinery (`buildErrorEnvelope`,
`extractError`, `extractSuggestedNextActions`, `writeAgentErrorEnvelope`) that the
mutation path and `session` command already use; it does not weaken any prior
gate. It extends the same envelope discipline to the `actor` read/by-id commands.

## Completion Conditions

1. **Every actor command in the error-surface corpus translates an API failure
   into a structured envelope and never leaks a raw `ApiError` class string.**
   The corpus is a source-of-truth fixture,
   `apps/cli/tests/fixtures/actor-error-surface-commands.txt` (one `vspec actor`
   sub-action per line; `#` comment and blank lines ignored). This is a universal
   claim: the gate enumerates every non-comment line from that file and loops the
   **real** `runActor` over each one against a stubbed 404 response — no
   single-case cheat. For each command the captured output must (a) contain no
   `ApiError:` class string and (b) carry a stable error `code`. The corpus must
   encode the dogfood anchor command (`show`) plus a representative spread (>= 3)
   of the actor commands that resolve an actor against the API (`show`, `edit`,
   `archive`, `list`). Future dogfood findings of the same shape append a line
   here rather than re-opening the per-command handling.
2. **An unresolved actor is self-teaching.** When `actor show`/`edit`/`archive`
   cannot resolve the supplied actor, the emitted envelope names the lookup key
   the agent passed and its `suggested_next_actions` points at `vspec actor list`
   (so the agent can retry with the listed id). Behaviour — in both `--format
   agent` and the default human output — is locked by unit tests in
   `apps/cli/tests/unit/actor-command.test.ts`.
3. **The actor read/write happy paths stay green.** `actor list`/`show`/`edit`/
   `archive` success output is unchanged, and the success cases still emit no
   `ApiError` string. Locked by `apps/cli/tests/unit/actor-command.test.ts`.
4. The CLI typechecks and the targeted behaviour suite passes.

## Sources Of Truth

- The dogfood finding for DF-005 (`vspec actor show <name>` leaks raw `ApiError`).
- `apps/cli/tests/fixtures/actor-error-surface-commands.txt` (the error-surface
  corpus; source of the enumerated actor commands).
- `apps/cli/src/commands/actor.ts` (`runActor`, `showActor`, `editActor`,
  `archiveActor`, `listActors`).
- `apps/cli/src/commands/agent-error-envelope.ts`,
  `apps/cli/src/application/mutation-runner.ts` (existing envelope machinery the
  fix should reuse rather than re-invent).
- `apps/cli/src/domain/error-codes.ts`, `apps/cli/src/domain/envelope.ts`.
- `apps/cli/tests/unit/actor-command.test.ts`.

The corpus is enumerated from source by stripping `#` comments and blank lines
from the fixture; the gate loops the real `runActor` over every remaining command
against a stubbed 404 and asserts no `ApiError` leak and a structured `code`. The
dogfood anchor command (`show`) must be present so the corpus genuinely encodes
the regression.

## Verification

```
pnpm --filter @vooster/cli typecheck
pnpm exec vitest run apps/cli/tests/unit/actor-command.test.ts
bash goals/71-dogfood-vspec-actor-show-name-leaks-raw-apierror-api-reque.gates.sh
bash scripts/completion-check.sh
```
