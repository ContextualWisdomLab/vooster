# Goal 74 -- `vspec usecase verify` must never leak a raw `ApiError` class string or a bare `Error`; a missing or unresolved use case key returns a self-teaching envelope

> An agent taking this goal active must first read
> `guidelines/goal-iteration.md` for the iteration protocol.

## Mission

`vspec usecase verify --format=json` (run with **no** use case key) exited 1 and
printed the bare internal error-class string `ApiError: API request failed with
404.` -- no `code`, no `details`, no `suggested_next_actions`. The dogfood agent
had no way to learn what went wrong; it recovered only by guessing to add an
explicit key (`vspec usecase verify POCKET-001 --format=json`), which then
returned `status: pass`.

There are two failure modes on this one command, and both leak instead of
teaching:

1. **No key supplied.** `runVerify` in `apps/cli/src/commands/verify.ts` resolves
   its argument through `verifyFlagsFrom` → `requiredArgument(usecaseId,
   "usecase-id")`, which throws a bare `Error("Missing usecase-id.")`. That error
   has no stable `code` and no `suggested_next_actions`, and it propagates to
   oclif's top-level handler, which stringifies it to stderr. (Depending on how
   the empty argument is threaded, the request can also reach the API and come
   back as a raw `ApiError: … 404`.)
2. **Unresolved key supplied.** When a key is given but the API returns 404,
   `fetchJson` throws `ApiError` and `runVerify` never catches it, so the raw
   `ApiError: API request failed with 404.` class string reaches the terminal.

Both must become a self-teaching agent error envelope: a stable `code`, a message
that names what is wrong (the missing `usecase-id` argument, or the unresolved
key the agent passed), and `suggested_next_actions` that point the agent at
`vspec usecase list` (to discover a valid key) and at verifying a specific key.

The binding contract of this goal is the CLI surface -- what reaches the user's
terminal. The API may additionally enrich its 404 Problem Details, but that is
not what this goal gates.

## Why This Goal Exists

This resolves the DF-005 facet recorded in the dogfood loop: command 8 `vspec
usecase verify --format=json 2>&1` produced `Exit code 1` then `ApiError: API
request failed with 404.` with no `code`, no `details`, and no
`suggested_next_actions`; the agent only recovered by guessing to add an explicit
key. A bare error-class string is a self-teaching failure -- the agent cannot tell
whether the argument was missing, the key was wrong, or the server was down.

This is additive to the existing agent-envelope machinery the verify command and
the mutation path already use (`buildAgentEnvelope`, the shared error-code set);
it does not weaken any prior gate. It extends the same envelope discipline to
`usecase verify`'s error surface.

## Completion Conditions

1. **Every failure scenario in the verify error-surface corpus translates into a
   structured envelope (stable `code`) and never leaks a raw `ApiError` class
   string or a bare `Error:` message.** The corpus is a source-of-truth fixture,
   `apps/cli/tests/fixtures/usecase-verify-error-surface.txt` (one verify
   invocation per line; `#` comment and blank lines ignored). The sentinel line
   `__NONE__` means "invoke `vspec usecase verify` with NO use case key"; any
   other token is passed as the use case key. This is a universal claim: the gate
   enumerates every non-comment line from that file and loops the **real**
   `runVerify` over each one against a stubbed 404 response -- no single-case
   cheat. For each scenario the captured output must (a) contain no `ApiError:`
   class string, (b) contain no bare leaked `Error:` string, and (c) carry a
   stable error `code`. The corpus must encode the dogfood anchor scenario
   (`__NONE__`, the no-key case) plus a representative spread (>= 2 total) that
   also covers the unresolved-key 404 case. Future dogfood findings of the same
   shape append a line here rather than re-opening per-scenario handling.
2. **A missing or unresolved key is self-teaching.** When `usecase verify` is run
   with no key, the emitted envelope names the missing `usecase-id` argument; when
   run with a key the API cannot resolve, the envelope names the key the agent
   passed. In both cases `suggested_next_actions` points at `vspec usecase list`
   (so the agent can discover a valid key) and at verifying a specific key.
   Behaviour -- in both `--format agent` and the default human output -- is locked
   by unit tests in `apps/cli/tests/unit/usecase-verify-error-surface.test.ts`.
3. **The verify happy path and existing failure statuses stay green.** A resolved
   use case still verifies (`pass` / `broken_links` / `unlinked_steps` / etc.
   unchanged), and the success path still emits no `ApiError` string. Locked by
   the existing verify unit suites plus the new error-surface suite.
4. The CLI typechecks and the targeted behaviour suite passes.

## Sources Of Truth

- The dogfood finding for DF-005 (`vspec usecase verify` with no key leaks raw
  `ApiError: 404`).
- `apps/cli/tests/fixtures/usecase-verify-error-surface.txt` (the error-surface
  corpus; source of the enumerated verify scenarios).
- `apps/cli/src/commands/verify.ts` (`runVerify`, `verifyFlagsFrom`).
- `apps/cli/src/flag-values.ts` (`requiredArgument`).
- `apps/cli/src/agent-envelope.ts` and the shared error-code set (existing
  envelope machinery the fix should reuse rather than re-invent).
- `apps/cli/tests/unit/usecase-verify-error-surface.test.ts`.

The corpus is enumerated from source by stripping `#` comments and blank lines
from the fixture; the gate loops the real `runVerify` over every remaining
scenario against a stubbed 404 and asserts no `ApiError` leak, no bare `Error:`
leak, and a structured `code`. The dogfood anchor scenario (`__NONE__`) must be
present so the corpus genuinely encodes the regression.

## Verification

```
pnpm --filter @vooster/cli typecheck
pnpm exec vitest run apps/cli/tests/unit/usecase-verify-error-surface.test.ts
bash goals/74-dogfood-vspec-usecase-verify-with-no-key-leaks-raw-apierro.gates.sh
bash scripts/completion-check.sh
```
