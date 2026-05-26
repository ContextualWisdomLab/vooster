---
title: "Use-case invocation links (invokes / invoked-by)"
created_at: 2026-05-26T15:04:22Z
resolved: true
priority: P2
status_notes: |
  Stage 3 — CLOSED on 2026-05-27: contract-surface callee changes now walk
  reverse `invokes` edges transitively/cycle-safely and add caller sessions with
  reason "의존 UC의 계약 변경" without forging caller severity.
  Stage 2 — CLOSED on 2026-05-27: local impact severity now classifies
  invocation edits from the caller revision diff: add = NON_BREAKING,
  remove/retarget = BREAKING.
  Stage 1b — CLOSED on 2026-05-27: delegated web rendering goal 34 is green
  (commits cb8ebff, eb58bb6, 8d4a549).
  Stage 1a — CLOSED on 2026-05-27: backend schema/domain `Step.invokes`, markdown
  includes parse/render, doctor warnings, and derived API `invoked_by` are green.
related:
  - docs/03-cockburn-method.md
  - docs/05-data-model.md
  - docs/08-file-format.md
  - apps/api/prisma/schema.prisma
  - apps/api/src/application/impact-analysis.ts
  - docs/findings/2026-05-24T1100-spec-impl-audit.md
---

# Use-case invocation links (invokes / invoked-by)

## TL;DR

Cockburn's method assumes a user-goal use case's steps **invoke** lower-level
subfunction use cases, but vspec models no such edge: a `Step` cannot reference
another `UseCase`. This finding proposes a **step-level invocation link**
(stored forward as `invokes`, the reverse `invoked-by` view derived by query),
its markdown authoring grammar, its referential-integrity policy, and — the
load-bearing part — how it threads through the existing **impact-analysis**
engine, including **contract-surface transitive impact**. It is post-beta (P2),
consumer-driven; not started.

---

## What's missing today

The relationship is **implied by the methodology but absent from model, file
format, and enforcement** — it is net-new, not a half-built feature.

- **Methodology assumes it.** `docs/03-cockburn-method.md:46` defines
  `SUBFUNCTION` as a use case that _"supports user-goal **steps**; e.g.,
  'Authenticate user.'"_ The relationship lives at the **step** level: a step
  in a higher-altitude UC invokes a lower one.
- **The schema has no edge.** `model Step`
  (`apps/api/prisma/schema.prisma:203-217`) holds `scenario_id` (205),
  `actor_id` (207), `action` (208), and relations to `Scenario`/`Actor` only —
  **no reference to another `UseCase`**. The only existing UC cross-reference
  anywhere is `Goal.linked_usecase_id` (`schema.prisma:144`, relation
  `GoalLinkedUseCase` at :151), i.e. backlog→spec promotion — a useful
  precedent for shape, not the same relationship.
- **The file format has no syntax.** `docs/08-file-format.md:128-133` writes
  steps as `1. **Actor** verb phrase.` with no invocation token.
- **Enforcement is silent.** The "What vspec Enforces Automatically" table
  (`docs/03-cockburn-method.md:138-150`) has rules for actor/stakeholder
  references but none for a sub-use-case reference.

Consequence: `level` is today an **unvalidated manual label.** An author can tag
a UC `SUBFUNCTION` with zero relationship to anything. The invocation link is
what would make the level taxonomy _earn its meaning_ (a subfunction is
_provably_ invoked; a summary _provably_ bundles), and is the prerequisite for
"where is this subfunction used?" traceability and cross-UC impact.

---

## Proposed model

### Edge at the step level

A step may declare zero or more invocations of other use cases in the **same
project**:

- New field on `Step` (MVP-style: a JSON/`String[]` of target **keys**,
  consistent with the schema's String-encoding simplification noted in
  `docs/05-data-model.md:9-14`). Concretely: `Step.invokes: String[]` holding
  human keys (e.g. `["CHECKOUT-007"]`).
- A later rigor pass can promote this to a join entity (`StepInvocation`) with a
  real FK once warranted — same "free-text/key reference now, entity later"
  staging vspec already uses for `scope` (`docs/05-data-model.md:144` free-text
  vs. the `SystemBoundary` entity sketched in `docs/ideation.md:345`).

### Store forward, derive reverse

- **Stored:** the forward edge `invokes` on the calling step. This is the only
  source of truth; it rides the calling UC's existing `Step` revision snapshot —
  no new versioning machinery.
- **Derived:** the `invoked-by` view (reverse navigation, "used by") is a
  **query**, not stored. No redundant back-pointers to keep in sync.

### Shape

- **Many-to-many DAG**, not a tree: one subfunction is shared by many callers;
  one caller invokes many subfunctions. (This is exactly why a parent-pointer
  tree was rejected for the list UI.)
- **Self-reference forbidden**; **cycle detection = warn** (A→…→A surfaced by
  `doctor`, not a hard block).
- **Same-project only.** `key` is unique per project
  (`docs/05-data-model.md:157`); cross-project invocation is out of scope.

---

## Authoring format

Attach the link to the step using the **existing step-annotation grammar**.
`docs/08-file-format.md` already carries trailing `_(Protected by: …)_` on
stakeholder lines (:116) and `(Outcome: … — rejoins main at step N)` on
extensions (:141, :146). Mirror that:

```markdown
## Main Success Scenario

1. **Customer** submits the order.
2. **System** validates the cart. _(includes: CHECKOUT-006)_
3. **System** processes the payment. _(includes: CHECKOUT-007)_
```

- Token form: `_(includes: <KEY>[, <KEY>...])_`, parsed case-insensitively like
  the sibling `(Outcome: …)` rule (`docs/08-file-format.md:168-169`).
- Round-trips through `serialize(parse(F))` like every other section
  (`docs/08-file-format.md:173-183`).

---

## Integrity policy

Lenient at authoring, surfaced by validation — same tier as actor-reference
checking (`docs/08-file-format.md:203-204`, currently 🔵 Planned).

- References are authored by **human key**; resolved to the internal id on sync
  (mirrors the `id`/`key` split, `docs/08-file-format.md:3`).
- **Dangling references are allowed mid-authoring** and produce a **`doctor`
  warning**, not a render/sync crash. (Author may reference a UC not yet
  created, or one later renamed/deleted.)
- Add a row to the enforcement table (`docs/03-cockburn-method.md:140`):
  _"`includes:` target exists in project — warn."_

---

## Impact-analysis interaction

This is the systemic core. The impact engine
(`apps/api/src/application/impact-analysis.ts`) today evaluates a **single use
case in isolation**: `ImpactPayload` (:12-19) carries `affected_sessions` and a
`severity` of `"BREAKING" | "COSMETIC" | "NON_BREAKING"`; `affectedActiveSessions`
(:152-162) finds only the sessions pinning **that one usecase**. There is no
notion of one UC depending on another. Introducing the edge forces two
questions.

### 3a — Link edits are tracked changes (local; in v1)

Editing an `_(includes: …)_` annotation is itself a change. Add rows to the
Severity Classification Rules (`docs/05-data-model.md:307-331`):

| Change to a step's `invokes`       | Severity     | Analogue in existing table           |
| ---------------------------------- | ------------ | ------------------------------------ |
| Add an invocation                  | NON_BREAKING | "Add a `Step` after the last" (:315) |
| Remove an invocation               | BREAKING     | "Delete a `Step`" (:319)             |
| Retarget an invocation (007 → 009) | BREAKING     | "Change `Step.action`" (:318)        |

Scope: the **caller's own** revision diff. Low complexity.

### 3b — Contract-surface transitive impact (in v1)

When a **callee** (subfunction) changes, propagate to its **callers** — but
**only on contract-surface changes**, never on internal edits. Rationale: a use
case is a _contract_ (`docs/03-cockburn-method.md:8-18`); a caller depends on
the callee's **guarantees**, not its internal scenario. Naive "any BREAKING
propagates" would flag every caller on a one-word internal step edit → alert
fatigue → the report gets ignored.

Propagate when the callee changes one of:

| Callee field changed            | Propagate to callers? | Why                                |
| ------------------------------- | --------------------- | ---------------------------------- |
| `success_guarantee` weakened    | ✅                    | caller's relied-on guarantee broke |
| `minimal_guarantee` weakened    | ✅                    | failure-path guarantee moved       |
| `primary_actor` changed         | ✅                    | who performs it is contract        |
| `trigger` changed               | ✅                    | entry contract                     |
| internal step text / added step | ❌                    | implementation, not contract       |
| `title`, `level`                | ❌                    | cosmetic to caller                 |

**Mechanism — extend "affected", do not forge severity.** Do _not_ rewrite the
caller's own diff to `"BREAKING"`. Instead extend the existing affected-set
machinery: `affectedActiveSessions` (`impact-analysis.ts:152`) walks the
**reverse invocation edges** from the changed callee to its callers, adding
those callers' use cases (and the sessions pinning them) to `affected_sessions`
with a reason like `"의존 UC의 계약 변경"`. This reuses `ImpactPayload`
(:12-19) and `MergeRequest.impact` (`docs/05-data-model.md:250`) shapes —
additive, no new severity enum value.

Multi-hop (subfunction ← user-goal ← summary) follows the same edges
transitively; cycle-safe via the same detection as authoring.

---

## Options / Recommendation

Decisions already settled for this finding:

1. **Granularity → step-level** (not UC-level). Faithful to
   `03-cockburn-method.md:46`; fits the existing step-annotation grammar.
2. **Integrity → lenient** (key-based, dangling allowed + `doctor` warn,
   same-project only).
3. **Impact → transitive included**, gated on the **contract-surface
   attenuation policy** above, expressed by extending the affected-set (not by
   forging caller severity).
4. **Doc/shape → store `invokes`, derive `invoked-by`**; this is a finding
   (queued, P2), not yet a goal.

**Load-bearing decision — LOCKED 2026-05-27 (user-approved).** The
**contract-surface field set** in 3b's first table is **final** for this
implementation: propagate to callers on a change to `success_guarantee`,
`minimal_guarantee`, `primary_actor`, or `trigger`; do **not** propagate on
internal step text, added/removed steps, `title`, or `level`. This is no longer
an open question — dogfood may tune it later via a follow-up finding, but it
does not block landing 3b. With D1 (`Step.invokes: String[]`), D2 (grammar
`_(includes: <KEY>)_`), and this field set all settled, every stage below is
decision-free mechanical TDD.

---

## Acceptance signal

Closed when a future goal lands all three, verified — not "tests pass" alone:

1. **Edge round-trips.** A `specs/` use case with `_(includes: CHECKOUT-007)_`
   survives `parse → serialize → normalize` unchanged (extend the round-trip
   guarantee, `docs/08-file-format.md:173-183`).
2. **Reverse view resolves.** Querying UC-007 returns CHECKOUT-001/002 as
   `invoked-by` (derived), with no stored back-pointer.
3. **Transitive impact fires on contract change only.** A test fixture where
   UC-001 and UC-002 invoke UC-007: weakening UC-007's `success_guarantee`
   adds UC-001/UC-002 (and their pinning sessions) to `affected_sessions` in
   `ImpactPayload`; editing only UC-007's internal step text does **not**.
   (New cases against `apps/api/src/application/impact-analysis.ts`.)

---

## Migration plan

One finding, three sequenced stages (sequence, not scope-cut):

1. **Edge + authoring + integrity + reverse view.** `Step.invokes` field +
   migration; `_(includes: …)_` parse/serialize; `doctor` existence warn +
   cycle/self-ref warn; derived `invoked-by` query; API + web detail rendering
   of "호출 / 호출됨".
2. **Local severity (3a).** Add the three `invokes`-edit rows to the Severity
   Classification Rules and to `impact-analysis.ts` diffing.
3. **Contract-surface transitive impact (3b).** Reverse-edge walk in
   `affectedActiveSessions`; the contract-surface attenuation gate; multi-hop +
   cycle-safe traversal; extend `MergeRequest.impact` consumers (review UI).

Stage 1 alone delivers traceability/navigation value; 2 and 3 layer impact
intelligence on top once edges exist to test against.

---

## Build spec — unattended execution split (locked 2026-05-27)

Picked up by cycle `cycles/260527-01-*`. Decisions locked above. Each stage is
its own RED→GREEN→REFACTOR; commit per stage. **Backend = direct TDD; web
rendering = claude-owned delegate goal** (cwd `apps/app`, per
`docs/claude/delegation.md`).

- **Stage 1a — schema + parse/serialize (DIRECT TDD).**
  - `Step.invokes String[] @default([])` in `apps/api/prisma/schema.prisma`
    (model `Step`, ~:203) + migration.
  - `invokes: string[]` on `StoredStep` (`apps/api/src/domain/entities/step.ts`).
  - Parse/serialize the trailing `_(includes: <KEY>[, <KEY>...])_` token,
    case-insensitive, in the markdown renderer/parser; **round-trip gate**:
    `serialize(parse(F)) === F` (Acceptance signal #1).
  - `doctor`: dangling-key warn + self-ref/cycle warn (not a hard block).
  - Derived **`invoked-by`** query (reverse scan, no stored back-pointer);
    expose on the use-case read endpoint (Acceptance signal #2).
- **Stage 1b — web rendering (DELEGATE to claude, cwd `apps/app`).**
  Render "호출 / 호출됨" (calls / called-by) sections on the use-case detail
  page from the API's `invokes` / derived `invoked_by`. Pure presentation;
  no contract decisions. Gate only after Stage 1a backend is green.
- **Stage 2 — local severity (DIRECT TDD).** Add the three `invokes`-edit rows
  to the Severity Classification Rules (`docs/05-data-model.md:307-331`) and to
  `impact-analysis.ts` diffing: add = NON_BREAKING, remove = BREAKING,
  retarget = BREAKING.
- **Stage 3 — contract-surface transitive impact (DIRECT TDD).** Extend
  `affectedActiveSessions` (`apps/api/src/application/impact-analysis.ts:152`)
  to walk reverse `invokes` edges and add callers' sessions to
  `affected_sessions` **only** when a locked contract-surface field changed
  (reason `"의존 UC의 계약 변경"`). Multi-hop + cycle-safe. Additive to
  `ImpactPayload`; **do not** forge caller severity (Acceptance signal #3).

**Guard**: Stages depend in order (1a → 1b → 2 → 3). If any stage hits 3
RED→GREEN cycles without progress, mark this finding `partial` with a
status_notes line naming the last green stage, and move on — partial is fine.
