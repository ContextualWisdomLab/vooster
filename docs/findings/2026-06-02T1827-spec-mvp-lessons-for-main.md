---
title: "spec-mvp rebuild — lessons to port back into the main vooster product"
created_at: 2026-06-02T18:27:26Z
resolved: partial
priority: P1
resolved_by:
  - 9b618b3
  - e47082a
  - f211854
related:
  - docs/findings/2026-05-26T1234-agent-contract-followups.md
  - docs/findings/2026-05-22T1628-shared-api-contracts.md
  - docs/findings/2026-06-02T1804-spec-code-verification-trust-gap.md
status_notes: |
  L4 SKILL PORT CLOSED on 2026-06-03 via commit f211854. Evidence:
  .claude/skills/analyze-session/SKILL.md and scripts/extract.sh now exist and
  are adapted to docs/06-api-contract.md, docs/07-cli-spec.md, apps/* contract
  drift, local sync, and Korean-first heuristic signals. One-session digest is
  deferred until a concrete external session path is supplied. Remaining open:
  L3, L5, L6.
  L2 CLOSED on 2026-06-03 via goal 36 (commit e47082a; gate
  goals/36-usecase-error-contract.gates.sh). Evidence:
  apps/api/src/http/usecase-validation-problem.ts returns code, field, and
  allowed_values for invalid usecase create payloads;
  apps/cli/src/domain/error-codes.ts consumes apiErrorCodeSchema; no usecase
  authoring problem-title literals remain. Remaining open after L2: L3, L4, L5,
  L6.
  L1 CLOSED on 2026-06-03 via goal 35 (commit 9b618b3; gate
  goals/35-korean-verb-phrase.gates.sh). Evidence:
  apps/api/src/application/verb-phrases.ts exposes spec_language with default
  ko, and apps/api/tests/unit/application/verb-phrases.test.ts plus
  apps/api/tests/e2e/UC-009.test.ts cover Korean title validation and authoring.
  Remaining open after L1: L2, L3, L4, L5, L6.
  Source of the lessons is the SIBLING repo vooster-spec-mvp (the local-first
  CLI rebuild), at /Users/sumin/repos/vibemafiaclub/vooster-spec-mvp. The
  TARGET of every action below is THIS repo (apps/api, apps/cli, .claude/).
  Supersedes docs/findings/2026-06-02T1807-vspec-mvp-next-steps.md, which was
  framed backwards (how to improve spec-mvp itself); deleted from the tree in
  the same commit but remains in git history.
---

# spec-mvp rebuild — lessons to port back into the main vooster product

## TL;DR

`vooster-spec-mvp` is a clean local-first rebuild of vspec. Its commit history
is a sequence of **dogfood-driven improvements** the team made while rebuilding
from scratch. Several of them encode lessons the **main** product (apps/api +
apps/cli) has _not_ internalized. Comparing the spec-mvp improvement commits
against the current main-repo state surfaces six portable items. The two highest
are real, not cosmetic: **(L1)** the main product is Korean-first (the whole
`apps/www` landing is Korean) yet its verb-phrase validation is ASCII-only and
**silently fails on Korean titles**; **(L2)** the main product's error contract
is stringly-typed and leaks generic zod failures, where spec-mvp proved a typed,
self-teaching envelope. L1+L2 are gate-able production fixes; L3–L6 range from a
cheap process win (port the dogfood skill) to medium refactors.

## How this was derived

- **Source lessons:** `git log` in `vooster-spec-mvp` (60 commits) — the
  `feat/fix` tail (`827c5d2..8f9b610`) plus the clean-code pass
  (`915bab9..9e1ad35`) are the concrete improvements.
- **Target state:** a code survey of this repo's agent-facing contract across
  `apps/cli` and `apps/api` (file:line below).
- Where the main repo **already** tracks a lesson, this finding defers to it
  (`2026-05-26T1234-agent-contract-followups.md` covers suggested-command
  truthfulness + envelope `format_version` consolidation). The items below are
  the parts **not** yet tracked.

## The portable lessons

### L1 — Korean-aware validation + a `spec_language` concept _(P1, real bug)_

**Lesson (spec-mvp).** `59be63e feat: add Korean spec guidance and quality lint`,
`3b00a9f fix: make doctor quality heuristics Korean-aware`, `7b3c83c fix: derive
Korean-aware filenames and reject empty slugs`. spec-mvp's `.vspec/config.json`
defaults `spec_language: ko`, and its doctor/verb-phrase heuristics are written
not to false-positive on Hangul.

**Main-repo state (broken).** Verb-phrase detection is hardcoded English:
`apps/api/src/application/verb-phrases.ts:1-44` holds an English verb list and
matches with `^[A-Za-z]+` (ASCII-only), so a Korean title (`주문을 생성한다`)
**never** matches and the check fails silently — no error explaining why. doctor
messages are English-only (`apps/api/src/application/doctor.ts:114-149`), and
there is **no `spec_language` concept** anywhere.

**Why it applies.** This product's ICP is Korean (`apps/www` is entirely
Korean). An English-only title validator on a Korean-first spec tool is a
correctness bug, not an i18n nicety.

**Action.** Port spec-mvp's Korean-aware verb-phrase + quality heuristics; add a
`spec_language` (default `ko`) that selects them. **Acceptance:** a Korean
verb-phrase title passes verb-phrase validation; doctor does not false-flag
Korean prose; `grep "spec_language" apps/` is non-empty.

### L2 — Typed, self-teaching error contract (map zod failures; name the field) _(P1)_

**Lesson (spec-mvp).** `afaadf4 fix: map frontmatter/zod failures to a clean
INVALID_FRONTMATTER envelope`, `c2da1d9 fix: make INVALID_ARGUMENT errors name
the offending arg and valid values`, `e3986cb fix: validate usecase set values
so they cannot corrupt the file`, and the clean-code pass `3053dec/74e300f`
(P4-T1/T2): an `ErrorCode` union + an **exhaustive** `errorInfo` switch so the
compiler forbids an unmapped code.

**Main-repo state.** A 12-code enum exists
(`apps/cli/src/domain/error-codes.ts:3-16`), but it is reached by **brittle
HTTP-status + problem-title string matching** (`error-codes.ts:26-41`, e.g.
matching the literal `"Use case title should be a verb phrase"`). Throws are
stringly-typed (`throw new Error("…")`). Worst: zod validation failures map to a
**generic** `problem(400, "Invalid use case request")` with no detail
(`apps/api/src/http/usecase-routes.ts:81-83`) — the agent is told it failed but
not _which field_ or _what was allowed_.

**Why it applies.** Self-teaching errors are the agent's primary recovery
channel. A generic 400 forces the agent to guess; title-string matching breaks
the moment a message is reworded (and L1's Korean messages would break it
outright).

**Action.** Map zod failures to a coded envelope carrying the offending field +
allowed values; derive the `error.code` from the source of the error, not from
title-string matching. **Acceptance:** an invalid usecase payload returns a
coded error naming the field; `grep` for problem-title literals in
`error-codes.ts` shrinks toward zero.

### L3 — Agent-first defaults + one error-envelope family across CLI & API _(P2)_

**Lesson (spec-mvp).** `9993716 default --format to agent`, then `af03f73 drop
--format and always emit the agent envelope` — the agent is the primary user, so
the structured envelope (success **and** error) is the default, not opt-in.

**Main-repo state.** `--format` defaults to **human** (`apps/cli/src/commands/
init.ts:179`, `diff.ts:154`, `usecase-flags.ts:171`), and the API speaks a
**separate** RFC-7807 `problem` shape (`apps/api/src/http/signup-support.ts:
254-267`) that is disjoint from the CLI envelope — the CLI must translate two
contracts, and `suggested_next_actions` is not guaranteed on every error path.

**Why it applies / caveat.** Unlike spec-mvp, the main CLI is genuinely
dual-audience (humans run it too), so "drop `--format`" is **not** the right
port. The portable parts are: (a) default to the structured envelope when an
agent context is detected, and (b) make the API error shape a member of the same
envelope family so there is one error schema, not two. **Action.** Align the API
problem shape with the envelope `error` contract; route all error paths through
one handler that always sets `suggested_next_actions`. **Acceptance:** API error
and CLI error validate against one shared schema; no error path omits
`suggested_next_actions`.

### L4 — Port the `analyze-session` dogfood loop as a repeatable process _(P2, cheap)_

**Lesson (spec-mvp).** `3509474 feat: add analyze-session skill` —
`.claude/skills/analyze-session/SKILL.md` mechanically turns one real external
agent session (`.jsonl`) into a **prioritized, direction-aligned** fix list: a
friction-signal catalog mapped to likely defects, classified by the QUANTS
lens, with an extractor that avoids blowing context on the raw transcript.

**Main-repo state.** The repo has dogfood _snapshots_
(`docs/findings/2026-05-22T1632-dogfood-snapshot.md` and follow-ups) but **no
repeatable skill** that converts a session into prioritized fixes — each dogfood
pass is hand-rolled.

**Action.** Port the skill to this repo, adapting its "internalize the
direction" step to read `docs/06-api-contract.md` / `docs/07-cli-spec.md` and its
friction catalog to the apps/\* contracts. **Acceptance:**
`.claude/skills/analyze-session/` exists here; one external session has been
digested into queued findings.

### L5 — Canonical markdown round-trip / normalize for sync + export _(P2, medium)_

**Lesson (spec-mvp).** Round-trip + idempotence is a hard gate:
`serialize(parse(F)) === normalize(F)` and `normalize(normalize(F)) ===
normalize(F)`, backed by dedicated parse/serialize/normalize modules.

**Main-repo state.** No round-trip guarantee. `markdown-renderer.ts` is a
**one-way** template; sync only regex-replaces the `revision:` line
(`apps/cli/src/sync-files.ts:97-99`) with **no** parse→serialize→normalize step,
so exported→re-imported markdown is not guaranteed identical and sync diffs are
noisier than necessary.

**Action.** Introduce a canonical normalize for spec markdown so export→import is
idempotent and sync produces minimal diffs. **Acceptance:** an export-then-import
idempotence test exists and passes.

### L6 — Minor ergonomics: shared `parseEnum` + hyphen norm; section-level apply _(P3)_

**Lesson (spec-mvp).** P2 `parseEnum` unification (one helper that normalizes
case **and** `-`→`_`, checks the allowed set, and throws a friendly error
listing valid values); `8e6d9a6`/`apply --section` for token-cheap partial body
edits.

**Main-repo state.** Enums are case-normalized but **not** hyphen-normalized, via
per-flag ad-hoc validators (`apps/cli/src/commands/lock-flags.ts:76-83`, …); no
shared helper; no section-level stdin apply (all mutations go through full API
calls).

**Action.** Extract a shared enum parser; (optionally) add section-level apply to
cut sync/token cost. Low priority — do only if L1–L5 surface it.

## Recommendation (sequencing)

**L1 → L2 → L4 → L3 → L5 → L6.** L1 is a real correctness bug on the
product's core (Korean) audience and is contained to two modules. L2 is the
next-highest agent-recovery win and partly de-risks L1 (Korean messages would
break title-string matching). L4 is a few hours and makes every future pass
cheaper. L3/L5 are larger contract/format refactors; L6 is opportunistic.

## Goal-promotion judgment

**Promote L1 + L2 as a small goal chain.** Both are production changes with
enumerable gates (a Korean title passing validation; an invalid payload
returning a field-named coded error) and both directly serve the agent +
Korean-first ICP. L4 is a skill addition (do inline, no goal). L3 and L5 are
contract/format refactors that should each get their own scoped goal _after_
L1/L2. Per the findings protocol, cite this finding from any promoted goal's
`## Why This Goal Exists`; do not delete this file on promotion.
