# Dogfood quality rubric

The analyzer (`scripts/dogfood/dogfood-analyze.sh`) scores every captured
session against this rubric and emits findings shaped by
`dogfood/schema/findings.schema.json`. This rubric is the product-direction
lens; combine it with the friction-signal catalog and QUANTS taxonomy in
`.claude/skills/analyze-session/SKILL.md` (§3–§5), which the analyzer also
receives.

## Principles to judge against

1. The CLI and API are **agent-facing product surfaces**, not just dev tools.
2. Errors are **self-teaching**: stable `code`, clear message, useful `details`,
   and `suggested_next_actions` wherever recovery is possible.
3. API / CLI / contracts / web / local-sync agree on **shape and vocabulary**;
   drift is a product bug, not cosmetic.
4. Local markdown is part of the workflow; repeated hand-edits to synced specs
   followed by sync/doctor failures signal a capability or guidance gap.
5. The product is **Korean-first** where content-quality heuristics apply;
   English-only linting/title validation is a correctness risk.
6. Generated specs should carry **Cockburn fidelity** — actors, levels,
   stakeholders/interests, and first-class extensions, not flattened prose.

## Scoring dimensions (QUANTS)

For each finding, name the harmed dimension(s):

- **Q** Quality — wrong output, corrupt sync state, malformed/low-fidelity spec.
- **A** Attention — human/agent intervention, retry loops, dead ends.
- **N** iNtellectual load — methodology/enum knowledge the tool should carry.
- **T** Tempo — wasted turns/tokens; high turns-to-first-success.
- **S** Satisfaction/trust — output needs rereading or manual validation.

## Severity

- **P0** — corruption or contract break (sync corrupts state; leaked internals;
  a documented invariant violated).
- **P1** — agent recovery or core-workflow failure (could not complete the
  flow without guessing; missing capability; doctor false positive that
  degrades a good spec).
- **P2** — polish/process (wording, extra turns that still succeeded, nits).

## What "clean pass" means

A cycle ends the loop only when **no P0 and no P1** findings exist across all
cases. P2 findings are still recorded to `docs/findings/` as debt but do not
keep the loop spinning.

## Evidence discipline

Every finding must cite: the case id, the exact digest line / command / error
text, and the responsible code-or-docs area (`apps/api/src/http/*`,
`apps/cli/src/*`, `packages/contracts/src/*`, `apps/api/src/application/ai-guide.ts`,
`docs/06-api-contract.md`, `docs/07-cli-spec.md`, `apps/app`, `apps/www`, …).
No evidence → not a finding.
