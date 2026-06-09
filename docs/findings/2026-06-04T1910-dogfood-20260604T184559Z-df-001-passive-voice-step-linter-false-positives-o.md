---
title: Passive-voice step linter false-positives on active-voice steps (and rejects vspec's own guide/help examples)
created_at: 2026-06-04T19:10:26Z
resolved: true
priority: P1
source: dogfood-loop cycle 20260604T184559Z
related:
  - docs/dogfood-loop.md
---

# Passive-voice step linter false-positives on active-voice steps (and rejects vspec's own guide/help examples)

**TL;DR.** Tighten the passive-voice heuristic so a copular/adjectival clause ("is positive", "is selected") inside an active actor-led step does not trigger; only flag genuine passive constructions where the step's main verb is passive. Align the linter with vspec's own guide/help example wording so recommended text always passes. Korean content must not be linted by English-only rules.

Surfaced by the dogfood loop (cycle `20260604T184559Z`). QUANTS: QANT.
Root-cause area: `apps/api/src/application/passive-voice.ts (passive-voice detection used by step add), cross-checked against apps/api/src/application/ai-guide.ts and step add help examples in apps/cli/src`. Routing: codex.

## Evidence

Command 15 `vspec step add $SC --actor "Pocket" --action "validates the amount is positive and a category is selected"` returned (line 281) `Error: Step action uses passive voice` / `Next actions: vspec step add --force ...` and EXIT 1. The actor-led step is active voice ("Pocket validates..."); the heuristic flagged the subordinate clauses "is positive"/"a category is selected". Notably the ai-guide (line 62) and the step add help EXAMPLE (line 305) both recommend the near-identical wording `--action "validates the amount is positive and the category is selected"`, which the linter itself rejects.

## Recommendation

Tighten the passive-voice heuristic so a copular/adjectival clause ("is positive", "is selected") inside an active actor-led step does not trigger; only flag genuine passive constructions where the step's main verb is passive. Align the linter with vspec's own guide/help example wording so recommended text always passes. Korean content must not be linted by English-only rules.

## Acceptance signal

Re-running the dogfood case that produced this finding no longer
reports it at P0/P1 severity.

Resolved in Goal 45. Verification:

- `pnpm exec vitest run apps/api/tests/unit/application/passive-voice.test.ts apps/api/tests/unit/application/scenario-authoring.test.ts apps/api/tests/unit/application/step-editing.test.ts apps/api/tests/unit/http/scenario-support.test.ts`
  passed on 2026-06-04T20:01Z.
- `bash goals/45-dogfood-passive-voice-step-linter-false-positives-on-activ.gates.sh`
  passed on 2026-06-04T20:02Z.
