---
title: "vspec local-first MVP — next-step improvement plan (post-dogfood, post-cleanup)"
created_at: 2026-06-02T18:07:43Z
resolved: false
priority: P1
related:
  - docs/findings/2026-06-02T1804-spec-code-verification-trust-gap.md
  - docs/findings/2026-05-22T1632-dogfood-snapshot.md
  - docs/findings/2026-05-25T1516-persona-dogfood-harness.md
status_notes: |
  Subject is the SIBLING repo vooster-spec-mvp (the local-first CLI), not
  apps/* in this repo. All `vooster-spec-mvp/...` paths below are rooted in
  /Users/sumin/repos/vibemafiaclub/vooster-spec-mvp.
  2026-06-03 (cycle 260603-01): claims re-verified in the sibling repo (it is
  accessible, clean, on main, ~20 commits ahead of origin). W1-a (telemetry
  absent), W2 (no verify/diff/impact), W4a (actor/stakeholder set+apply
  undocumented in docs/03-cli-spec.md while implemented in src/cli.ts:147/155/
  181/189), and W4b (package.json 0.1.0, no files/publishConfig) all confirmed.
  W1-a + W2 are decision-locked and safe — but they belong in a dedicated cycle
  ROOTED IN vooster-spec-mvp; this run is authorized for vooster/main only, so
  no cross-repo autonomous commits are made. W3 (external dogfood) needs human
  target selection; W4b (distribution) needs an owner decision (npm/link/npx).
  KEEP open; promote as a sibling-repo cycle.
---

# vspec local-first MVP — next-step improvement plan

## TL;DR

`vooster-spec-mvp` has shipped its whole build plan (GOAL.md Phases 0–7,
dogfooding green) and then a full clean-code pass (clean-code-refactor goal,
P0–P6, commits `915bab9..9e1ad35`). The authoring loop is solid. But the commit
history shows the team has spent its last ~30 commits **polishing the agent's
authoring ergonomics** — and almost nothing on the question the project was
created to answer: _does feeding an agent a vspec use case actually make the
human more productive at getting code shipped?_ The measurement plan
(`docs/05-productivity-measurement.md`) is written but **none of its §8
prerequisites exist**. Meanwhile the spec is **write-only** — there is no link
from a spec step to code/tests, so an authored spec cannot be checked against an
implementation and will rot (the exact trust gap already filed for the main repo
in `2026-06-02T1804-spec-code-verification-trust-gap.md`). This finding lays out
a prioritized plan: **(W1) make the core bet measurable, (W2) close the
spec→code loop, (W3) dogfood on a real external project, (W4) clear two hygiene
debts.**

## What the commit history tells us (evidence)

Reading `git log` in `vooster-spec-mvp` (60 commits):

1. **MVP built to spec, fast.** `ca8099a..25f5ca1` lay down parser/serializer,
   doctor, init+authoring, entity commands, envelopes, gherkin — one commit per
   GOAL.md phase. `dcd62ac docs: dogfood vspec specs` reaches P7.
2. **A long tail of dogfood-driven UX fixes.** ~25 `feat/fix` commits
   (`827c5d2..8f9b610`) are all the _agent's_ experience: self-teaching errors
   (`48bf8e6`), enum hints in `--help` (`827c5d2`), Korean-aware heuristics
   (`3b00a9f`), CLI-only write path (`8e6d9a6`), verb-phrase titles (`1ae0f62`),
   actor/stakeholder body authoring (`8286b72`). Signal: the team is
   **smoothing the authoring surface**, which is exactly what `analyze-session`
   (the dogfood-feedback skill) is built to drive.
3. **Then a pure clean-code pass.** `915bab9..9e1ad35` (clean-code-refactor
   goal) dedupes paths/config/enums and type-safes error codes. Behavior
   preserved; no new product capability.

So the trajectory is **inward-facing polish**. The next unit of value is not
another ergonomics fix — it is proving (or disproving) the hypothesis and
closing the one structural gap that caps the product's value.

## The plan

### W1 — Make the core bet measurable _(P1, highest leverage)_

The reason vspec exists is hypothesis **H1** in
`vooster-spec-mvp/docs/05-productivity-measurement.md:17`: a vspec use case lets
the **human** finish the spec→implementation flow with less intervention and
more trust. The doc is a rigorous QUANTS×GSM design — but `§8` (`docs/05:224`)
lists five undone prerequisites, and **none are built**:

- No CLI telemetry. `grep -rniE 'telemetry|appendFile|writeLog|metric'
vooster-spec-mvp/src/` → nothing. There is no local log of command,
  duration, `doctor` result, round-trip, or `error.code` — so the T/Q/N/A
  signals the plan depends on cannot be collected automatically.
- No evaluation task set + hidden golden acceptance tests (`docs/05:228`).
- No human-burden survey kit, no run harness, no pre-registered numbers
  (`docs/05:230-235`, the X%p / Z× thresholds in `docs/05:193-201` are still
  drafts).

Without this, every W2–W4 improvement is unfalsifiable. Recommended order:

- **W1-a CLI telemetry (cheap, do first).** A single append-only local JSONL
  (`.vspec/telemetry.jsonl`, opt-out) recording `{ts, command, args_shape,
duration_ms, exit, error_code, doctor_errors, doctor_warns}`. This is the
  one §8 item that is also useful _outside_ the experiment (regression
  watch). Keep it boring — one writer in the existing `runCommand` path
  (`vooster-spec-mvp/src/cli.ts`), no new dependency.
- **W1-b task set + golden tests** (`docs/05:228`) — 6–10 standard coding
  tasks with _hidden_ acceptance tests; pull some from this project's own
  domain (parser/CLI) so it doubles as dogfood.
- **W1-c run harness + pre-registered thresholds** — script the
  (task × arm × K) matrix from `docs/05:233` and freeze the §6 decision
  numbers _before_ looking at data.

The headline output is one chart: the 4 arms (`C0/C1/C2/T`) plotted on the
(quality, human-burden) plane (`docs/05:183`). That chart is what decides
push / fix / shelve — nothing in the repo can produce it today.

### W2 — Close the spec→code loop _(P1, biggest product-value add)_

Today vspec is **write-only**: it authors and validates a spec, but nothing
connects a spec step to the code or test that satisfies it. Confirmed: `grep -rniE
"command\(['\"](verify|diff|impact)" vooster-spec-mvp/src/` → none. A spec that
can't be checked against code is precisely the spec that "becomes a lie" as code
drifts — and `docs/00-overview.md:122` defers the structural diff to a
fast-follow while `:120` rules AI judgment out of scope, leaving **no** drift
story at all.

This is the _same_ gap already filed against the main product in
`docs/findings/2026-06-02T1804-spec-code-verification-trust-gap.md`. The
local-first MVP can prototype the deterministic core of it without a server:

- Add an optional `implements: [<path>|<test-id>]` per scenario step (lives in
  the markdown body, parsed like the rest — keep files the source of truth,
  `docs/00-overview.md:28`). Round-trip and idempotence must still hold
  (clean-code-refactor INVARIANTS 1–2).
- `vspec verify [<KEY>]`: **deterministic only** — does each link resolve to a
  real file/test, and (delegated `--test-cmd`) do the linked tests pass. Never
  LLM judgment in the blocking path. Distinct exit code for "unlinked step"
  (incomplete coverage). Mirror T2's determinism criterion from the 1804
  finding (identical result across repeated runs).
- `doctor` counts unlinked steps as a warning.

This is the direct input to **W1**'s quality axis (`docs/05:108`, hidden
acceptance-test pass rate): a spec with verified links should produce
implementations that drift less.

### W3 — Dogfood on a real external project _(P1, cheap, high signal)_

Current dogfood is shallow and self-referential: all six use cases describe
vspec itself (`vooster-spec-mvp/specs/usecases/VSPEC-001..006`), and the
fresh-agent run is a single transcript (`docs/dogfood-fresh-agent.md`). The
`analyze-session` skill (`.claude/skills/analyze-session/SKILL.md`) is built to
turn a real agent session in _another_ repo into prioritized vspec fixes — but
there is no evidence it has been run on a genuine external session.

- Pick a real, non-trivial target repo, author its specs through `vspec` only,
  implement against them, and capture the session JSONL.
- Run it through `analyze-session` and let the friction catalog
  (SKILL.md §3) drive the next fix list — instead of guessing at ergonomics.
- This is also W1-b's task source and W2's first `verify` target. One exercise
  feeds three work items.

### W4 — Hygiene debts surfaced while reading the tree _(P2, cheap)_

- **Doc drift: `actor`/`stakeholder` `set` + `apply` are implemented but
  undocumented.** They exist in code (`vooster-spec-mvp/src/cli.ts:147` actor
  `set`, `:155` actor `apply`, `:181` stakeholder `set`, `:189` stakeholder
  `apply`) and in the agent guide (`src/ai-guide.ts`), but the command-surface
  spec `docs/03-cli-spec.md` (Supporting section, lines 82–106) lists neither.
  The doc the team treats as the contract is now behind the build. Fix:
  document them in `03-cli-spec.md`.
- **No distribution / global-install story.** `package.json` is `version
0.1.0`, unpublished, with no `files` / `publishConfig`, and recent commits
  show repeated "bin runs only from dist / fail loud when unbuilt" churn
  (`13f067f`, `9198a1b`, `af03f73`). For W3 (running `vspec` inside another
  repo) the agent needs the binary reliably on PATH. Decide the install path
  (npm publish, `pnpm link`, or a documented `npx`) and write it into
  `ai-guide` / README so the recurring "command not found" friction stops.

## Recommendation (sequencing)

**W1-a → W3 → W2 → W1-b/c**, with W4 slotted in opportunistically.

Rationale: telemetry (W1-a) is a few hours and instruments everything that
follows. A real external dogfood (W3) is the cheapest way to generate both the
task set (W1-b) and the first `verify` target (W2), and it will likely surface
friction that re-orders the rest. W2 is the highest _product_ value but should
be built against a real spec, not vspec's own. The full measurement (W1-b/c)
is the most expensive and should run last, once there is something worth
measuring.

## Acceptance signal

- W1-a: `.vspec/telemetry.jsonl` accrues one line per command;
  `grep appendFile vooster-spec-mvp/src/` is non-empty.
- W2: `vooster-spec-mvp/src/` has a `verify` command; a step can carry
  `implements:`; 10 repeated `verify` runs on a fixed commit give identical
  exit codes (the 1804 finding's determinism bar).
- W3: a non-vspec target repo's specs exist and were authored CLI-only; an
  `analyze-session` digest of its session is captured and its top findings are
  logged.
- W4: `03-cli-spec.md` documents `actor/stakeholder set|apply`; `ai-guide`/README
  states one supported install path.
- W1-b/c: the (quality, human-burden) 4-arm plot from `docs/05:183` can be
  regenerated by a checked-in harness.

## Goal-promotion judgment

**Promote W1 + W2 as a small goal chain; keep W3/W4 as findings-queue
follow-ons.** W1 (measurement) and W2 (`verify` + `implements` link) both touch
production code with hard, enumerable gates (telemetry-line invariant; the
repeated-run determinism criterion) and together decide the product's
direction. W3 is an exercise, not a gated deliverable; W4 is two cheap cleanups.
Per the findings protocol, do not delete this file on promotion — mark
`status_notes` "promoted to goal N" and cite it from the goal's
`## Why This Goal Exists`.
