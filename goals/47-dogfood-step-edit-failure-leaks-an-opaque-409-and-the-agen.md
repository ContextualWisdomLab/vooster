# Goal 47 -- `step edit` failures must render through the shared status-bearing envelope, not leak a raw 409

> An agent taking this goal active must first read
> `guidelines/goal-iteration.md` for the iteration protocol.

## Mission

When `vspec step edit` fails, an agent must get the **same** envelope contract it
gets on success -- a top-level `status` field it can branch on, and on failure a
stable `error.code`, a human-readable message naming the cause, and
`suggested_next_actions`. Today the edit path dead-ends into a leaked
client-library exception: under `--format=agent` the payload has **no**
top-level `status` key (so a consumer reading `d["status"]` raises
`KeyError`), and under human format it prints only
`ApiError: API request failed with 409.` with no stable code, no cause, and no
next action.

The fix already has a single shared producer in the codebase. `step add` routes
through `runMutationCommand` / `runMutation`
(`apps/cli/src/application/mutation-runner.ts`), which on success builds an
envelope with `status: "ok"` (`buildOkEnvelope`) and on **any** `ApiError`
catches it and builds `buildErrorEnvelope` -- `status: "error"`, a classified
`error.code` (`extractError`), and `suggested_next_actions`
(`extractSuggestedNextActions`). The edit path bypasses all of this: `editStep`
in `apps/cli/src/commands/step.ts` calls the raw `patchJson` client directly
(so an `ApiError` escapes uncaught) and renders success through the **legacy
status-less** `buildAgentEnvelope` (`apps/cli/src/agent-envelope.ts`), whose
envelope has no `status` field at all. Route the edit write through the one
shared mutation runner so success and failure share the same status-bearing
envelope -- do **not** add a second error-rendering path.

## Why This Goal Exists

This resolves
`docs/findings/2026-06-04T1910-dogfood-20260604T184559Z-df-001-step-edit-failure-leaks-an-opaque-409-and-t.md`
(case `DF-001`, P1). During the dogfood loop, command 19
(`vspec step edit ... --format=agent` piped to a script reading `d['status']`)
failed with `KeyError: 'status'` because the agent-format error payload lacked
the top-level `status` key that success envelopes carry. Command 20 (same edit,
human format) printed only `ApiError: API request failed with 409.` EXIT 1 -- a
leaked client-library exception string with no stable code, no message about the
missing pinned session, and no suggested next action. The agent recovered only
because the ai-guide had pre-told it that edits need an active pinned session.

Root cause: `editStep` in `apps/cli/src/commands/step.ts` does not use the
shared `runMutationCommand` machinery that every other mutating step path uses;
it calls `patchJson` directly (the raw exception escapes) and serializes through
the status-less `buildAgentEnvelope`. The API side already returns a Problem
Details body for its 409 conflict branches via `problem(...)`
(`apps/api/src/http/step-results.ts`), carrying `title`, `status`, and
`suggested_next_actions`; the CLI just never lets that body reach the agent.

## Completion Conditions

1. **Agent format always carries `status`.** For **every** mutating `vspec step`
   command path (the `add` and `edit` actions), the `--format=agent` output is a
   single envelope that always includes a top-level `status` field --
   `"ok"` on success and `"error"` on failure -- regardless of HTTP outcome. No
   step write path renders agent output through a status-less envelope builder.
2. **Failures are branchable, not leaked.** When `vspec step edit` gets an error
   response (e.g. a 409 conflict), the agent-format envelope carries
   `status: "error"`, a stable `error.code` (the status-classified code, e.g.
   `CONFLICT` / `REVISION_STALE`), and the API's `suggested_next_actions`. The
   human-format output prints a stable, human-readable message naming the cause
   plus the suggested next action and exits non-zero -- it never prints a raw
   `ApiError: API request failed with ...` exception string.
3. **API 409 conflict bodies stay Problem Details.** Each conflict branch the
   step-editing result can produce (stale base revision, hard lock, semantic
   lock) returns a Problem Details body carrying a `title` that names the cause,
   a `status`, and at least one `suggested_next_actions` entry, so the CLI can
   classify a stable code and surface a next action. This is locked by a test
   that drives the conflict branches, not by re-deriving the shape in the gate.
4. The API and CLI typecheck, the new edit-envelope and conflict-shape behavior
   is locked by unit tests, and the existing step add / step-agent-format /
   step-results / step-editing suites stay green.

## Sources Of Truth

- `docs/findings/2026-06-04T1910-dogfood-20260604T184559Z-df-001-step-edit-failure-leaks-an-opaque-409-and-t.md`
- `apps/cli/src/commands/step.ts`
- `apps/cli/src/application/mutation-runner.ts`
- `apps/cli/src/domain/envelope.ts`
- `apps/api/src/http/step-results.ts`
- `apps/cli/tests/unit/step-edit-envelope.test.ts`
- `apps/api/tests/unit/http/step-edit-conflict-problem.test.ts`

A behavior test proves the envelope contract for the paths it exercises, but it
cannot prove that some other step write path -- present or future -- silently
renders through the status-less `buildAgentEnvelope` or calls the raw `patchJson`
client (whose `ApiError` escapes uncaught). The set of bypass symbols that drop
the top-level `status` or leak a raw exception is enumerated in the gate and the
step command surface (`apps/cli/src/commands/step.ts`) must reference none of
them; every step write must instead flow through the shared status-bearing
mutation runner.

## Verification

```
pnpm --filter @vooster/api typecheck
pnpm --filter @vooster/cli typecheck
pnpm exec vitest run apps/cli/tests/unit/step-edit-envelope.test.ts apps/cli/tests/unit/step-agent-format.test.ts apps/api/tests/unit/http/step-edit-conflict-problem.test.ts apps/api/tests/unit/http/step-results.test.ts
bash goals/47-dogfood-step-edit-failure-leaks-an-opaque-409-and-the-agen.gates.sh
bash scripts/completion-check.sh
```
