---
title: `usecase show` (human format) omits the Extensions section
created_at: 2026-06-04T18:11:57Z
resolved: true
priority: P1
source: dogfood-loop cycle 20260604T180511Z
related:
  - docs/dogfood-loop.md
---

# `usecase show` (human format) omits the Extensions section

**TL;DR.** CLI fix: render the Extensions section (extension points, conditions, outcomes) in the human `usecase show` output so it reaches parity with the --format=agent payload and the markdown export. The data is stored correctly; only the human presentation drops it.

Surfaced by the dogfood loop (cycle `20260604T180511Z`). QUANTS: QS.
Root-cause area: `apps/cli/src/ (usecase show human renderer)`. Routing: codex.

## Evidence

Command 26 (`vspec usecase show TODO-001 | head -60`) followed by command 27 grepping the agent-format output specifically for EXTENSION/condition/'Title is empty'/FAILURE/2a (digest lines 44-45). Narration line 89: "The main scenario shows but not the extension." and line 105: "`usecase show` (human format) omits the Extensions section — I only confirmed the extension was stored via `--format=agent` and the markdown export." First-class extensions are a documented Cockburn-fidelity element but are invisible in the primary human view.

## Recommendation

CLI fix: render the Extensions section (extension points, conditions, outcomes) in the human `usecase show` output so it reaches parity with the --format=agent payload and the markdown export. The data is stored correctly; only the human presentation drops it.

## Acceptance signal

Re-running the dogfood case that produced this finding no longer
reports it at P0/P1 severity.

Resolved in Goal 44. Verification:

- `pnpm exec vitest run apps/cli/tests/unit/usecase-show-extensions.test.ts apps/cli/tests/unit/usecase-output.test.ts`
  passed on 2026-06-04T18:44Z.
- `bash goals/44-dogfood-usecase-show-human-format-omits-the-extensions-sec.gates.sh`
  passed on 2026-06-04T18:45Z.
