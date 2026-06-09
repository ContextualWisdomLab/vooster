---
title: step edit failure leaks an opaque 409 and the agent-format error envelope omits the documented status field
created_at: 2026-06-04T19:10:26Z
resolved: true
priority: P1
source: dogfood-loop cycle 20260604T184559Z
related:
  - docs/dogfood-loop.md
---

# step edit failure leaks an opaque 409 and the agent-format error envelope omits the documented status field

**TL;DR.** Return a Problem Details-style envelope on the 409 with a stable code (e.g. SESSION_REQUIRED / REVISION_CONFLICT), a human message naming the cause, and suggested_next_actions (`vspec session start --pin ...`). Ensure the agent-format error envelope always includes the same top-level status field as success responses so agents can branch on it without title/exception-string matching.

Surfaced by the dogfood loop (cycle `20260604T184559Z`). QUANTS: NAS.
Root-cause area: `apps/api/src/http (409 conflict response shape) and apps/cli/src/domain/envelope.ts (agent-format error rendering); docs/06-api-contract.md Problem Details contract`. Routing: codex.

## Evidence

Command 19 (`vspec step edit ... --format=agent` piped to a script reading `d['status']`) failed with `KeyError: 'status'` (line 328) — the agent-format error payload lacked the top-level `status` key that success envelopes carry (e.g. line 137/350 `"status": "ok"` / `status ok`). Command 20 (same edit, human format) printed only `ApiError: API request failed with 409.` (line 330) EXIT 1 — a leaked client-library exception string with no stable code, no message about the missing pinned session, and no suggested_next_actions. The agent recovered only because the ai-guide had pre-told it edits need an active pinned session (narration line 112).

## Recommendation

Return a Problem Details-style envelope on the 409 with a stable code (e.g. SESSION_REQUIRED / REVISION_CONFLICT), a human message naming the cause, and suggested_next_actions (`vspec session start --pin ...`). Ensure the agent-format error envelope always includes the same top-level status field as success responses so agents can branch on it without title/exception-string matching.

## Acceptance signal

Re-running the dogfood case that produced this finding no longer
reports it at P0/P1 severity.

## Resolution

Routed `vspec step edit` through the shared mutation runner so agent output
always carries `status` and API errors render as classified envelopes with
suggested next actions.

Verified with:

- `pnpm exec vitest run apps/cli/tests/unit/step-edit-envelope.test.ts apps/cli/tests/unit/step-agent-format.test.ts apps/api/tests/unit/http/step-edit-conflict-problem.test.ts apps/api/tests/unit/http/step-results.test.ts`
- `pnpm --filter @vooster/api typecheck`
- `pnpm --filter @vooster/cli typecheck`
- `bash goals/47-dogfood-step-edit-failure-leaks-an-opaque-409-and-the-agen.gates.sh`
