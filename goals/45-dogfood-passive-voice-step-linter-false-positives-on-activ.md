# Goal 45 — vspec must never recommend step wording its own linter rejects

> An agent taking this goal active must first read
> `guidelines/goal-iteration.md` for the iteration protocol.

## Mission

vspec's passive-voice step linter must be **self-consistent** with the wording
vspec itself recommends. Every step-action example that the product's own
AI guide and CLI help suggest must pass the linter, and Korean (Hangul) step
actions must never be judged by the English-only passive-voice rule.

## Why This Goal Exists

This resolves
`docs/findings/2026-06-04T1910-dogfood-20260604T184559Z-df-001-passive-voice-step-linter-false-positives-o.md`
(case `DF-001`, P1). During the dogfood loop, command 15
`vspec step add $SC --actor "Pocket" --action "validates the amount is positive and a category is selected"`
was rejected with `Error: Step action uses passive voice` and EXIT 1. The actor-led
step is active voice ("Pocket validates..."); the heuristic fired on the trailing
copular clauses `is positive` / `is selected`.

The damning part is **self-inconsistency**: vspec's own AI guide
(`apps/api/src/application/ai-guide.ts`, e.g. line 95 and line 179) and the
`step add` CLI help example (`apps/cli/src/cli-help.ts`, line 158) both recommend
the near-identical wording
`--action "validates the amount is positive and the category is selected"` — text
the linter itself rejects. A tool that recommends wording it then refuses is a
dogfood hazard: the agent following the guide hits a hard error on the documented
happy path.

Goal 41 scopes the detector to the step's **main predicate**. This goal adds the
durable, enumerated **regression guard** that keeps the linter and the docs in
lockstep going forward: if either the linter tightens again or a doc example
drifts into rejectable wording, this gate goes red. It also pins the Korean
exemption, which the English-only heuristic must not touch.

## Completion Conditions

1. **Self-consistency (universal).** Every step-action example wording that vspec
   recommends in its own documentation is classified as **not passive** by the
   shared `usesPassiveVoice` detector. The set of examples is enumerated from a
   source of truth — the `--action "<text>"` strings embedded in
   `apps/api/src/application/ai-guide.ts` and `apps/cli/src/cli-help.ts` — and the
   real detector is run over every one of them; none may be flagged. The
   enumeration must be non-empty (no zero-example cheat).
2. **Korean exemption.** A step action containing Hangul (e.g.
   `사용자가 금액을 입력하고 카테고리를 선택한다`) is never flagged by the
   English-only passive-voice rule. Locked by a unit test.
3. **No over-correction.** A genuinely passive English main predicate
   (`Order is submitted.`) is still flagged passive. Locked by a unit test.
4. The API typechecks and the passive-voice behavior suite passes.

## Sources Of Truth

- `docs/findings/2026-06-04T1910-dogfood-20260604T184559Z-df-001-passive-voice-step-linter-false-positives-o.md`
- `apps/api/src/application/passive-voice.ts` (the shared `usesPassiveVoice` detector)
- `apps/api/src/application/ai-guide.ts` (recommended step-action examples)
- `apps/cli/src/cli-help.ts` (recommended step-action examples)
- `apps/api/tests/unit/application/passive-voice.test.ts` (Korean exemption + over-correction lock)

The set of recommended examples is enumerated from source with
`grep -hoE -- '--action "[^"]+"' apps/api/src/application/ai-guide.ts apps/cli/src/cli-help.ts`,
and each is run through the real `usesPassiveVoice` from
`apps/api/src/application/passive-voice.ts`.

## Verification

```
pnpm --filter @vooster/api typecheck
pnpm exec vitest run apps/api/tests/unit/application/passive-voice.test.ts
bash goals/45-dogfood-passive-voice-step-linter-false-positives-on-activ.gates.sh
bash scripts/completion-check.sh
```
