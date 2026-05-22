# 05 — Data Model

This document defines the 16 MVP entities, their fields, and their
relationships. It is the authority for `prisma/schema.prisma`.

## Conventions

- All `id` fields are CUIDs (`@default(cuid())`).
- All timestamps are `DateTime` in UTC.
- Foreign keys use `<entity>_id` naming in markdown; Prisma maps to relations.
- Enum values are SCREAMING_SNAKE.
- `archived_at` (nullable) is the soft-delete column where supported.

## Entity Index

```
Organization (4):  Workspace, Project, User, Membership
Domain (8):        UseCase, Actor, Scenario, Step,
                   Stakeholder, StakeholderInterest, Goal, Revision
Concurrency (4):   WorkSession, SpecBranch, MergeRequest, Lock
Collaboration (1): Comment
```

---

## Organization Layer

### `Workspace`

| Field      | Type     | Notes                                  |
| ---------- | -------- | -------------------------------------- |
| id         | String   | PK.                                    |
| name       | String   |                                        |
| slug       | String   | URL-safe, unique.                      |
| owner_id   | String   | FK → User.                             |
| plan       | Enum     | FREE \| PRO \| ENTERPRISE (MVP: FREE). |
| settings   | Json     | Reserved.                              |
| created_at | DateTime |                                        |
| updated_at | DateTime |                                        |

### `Project`

| Field             | Type     | Notes                                |
| ----------------- | -------- | ------------------------------------ |
| id                | String   |                                      |
| workspace_id      | String   | FK → Workspace.                      |
| name              | String   |                                      |
| key               | String   | e.g. `PAY`. Unique per workspace.    |
| description       | String?  |                                      |
| visibility        | Enum     | PRIVATE \| INTERNAL.                 |
| default_branch_id | String?  | FK → SpecBranch (the `main` branch). |
| created_at        | DateTime |                                      |
| updated_at        | DateTime |                                      |

### `User`

| Field         | Type      | Notes                             |
| ------------- | --------- | --------------------------------- |
| id            | String    |                                   |
| github_id     | String    | Unique. The single auth identity. |
| email         | String    | Unique.                           |
| name          | String?   |                                   |
| avatar_url    | String?   |                                   |
| last_login_at | DateTime? |                                   |
| created_at    | DateTime  |                                   |

### `Membership`

| Field        | Type     | Notes            |
| ------------ | -------- | ---------------- |
| id           | String   |                  |
| user_id      | String   | FK → User.       |
| workspace_id | String   | FK → Workspace.  |
| role         | Enum     | OWNER \| EDITOR. |
| joined_at    | DateTime |                  |

Unique: `(user_id, workspace_id)`.

---

## Domain Layer

### `Actor`

| Field       | Type      | Notes                              |
| ----------- | --------- | ---------------------------------- |
| id          | String    |                                    |
| project_id  | String    |                                    |
| name        | String    | Unique per project.                |
| type        | Enum      | PRIMARY \| SUPPORTING \| OFFSTAGE. |
| description | String?   |                                    |
| is_human    | Boolean   | False for external systems.        |
| aliases     | String[]  |                                    |
| archived_at | DateTime? |                                    |
| created_at  | DateTime  |                                    |

### `Stakeholder`

| Field       | Type      | Notes                               |
| ----------- | --------- | ----------------------------------- |
| id          | String    |                                     |
| project_id  | String    |                                     |
| name        | String    | Unique per project.                 |
| type        | Enum      | INTERNAL \| EXTERNAL \| REGULATORY. |
| description | String?   |                                     |
| archived_at | DateTime? |                                     |
| created_at  | DateTime  |                                     |

### `Goal`

| Field             | Type      | Notes                                            |
| ----------------- | --------- | ------------------------------------------------ |
| id                | String    |                                                  |
| project_id        | String    |                                                  |
| actor_id          | String    | FK → Actor.                                      |
| description       | String    | e.g. "Submits an order."                         |
| level             | Enum      | SUMMARY \| USER_GOAL \| SUBFUNCTION.             |
| status            | Enum      | IDENTIFIED \| IN_DESIGN \| PROMOTED \| REJECTED. |
| linked_usecase_id | String?   | Set when promoted.                               |
| priority          | Enum      | P0 \| P1 \| P2 \| P3.                            |
| archived_at       | DateTime? |                                                  |
| created_at        | DateTime  |                                                  |

### `UseCase`

| Field                  | Type      | Notes                                          |
| ---------------------- | --------- | ---------------------------------------------- |
| id                     | String    |                                                |
| project_id             | String    |                                                |
| key                    | String    | Human ID, e.g. `PAY-001`. Unique per project.  |
| title                  | String    | Verb phrase.                                   |
| level                  | Enum      | SUMMARY \| USER_GOAL \| SUBFUNCTION.           |
| format                 | Enum      | BRIEF \| CASUAL \| FULLY_DRESSED.              |
| scope                  | String    | Free-text reference to a system boundary name. |
| primary_actor_id       | String    | FK → Actor.                                    |
| trigger                | String    |                                                |
| preconditions          | String[]  |                                                |
| success_guarantee      | String    |                                                |
| minimal_guarantee      | String    |                                                |
| frequency              | String?   |                                                |
| priority               | Enum      | P0 \| P1 \| P2 \| P3.                          |
| status                 | Enum      | DRAFT \| IN_REVIEW \| APPROVED \| DEPRECATED.  |
| current_revision_id    | String    | FK → Revision.                                 |
| archived_at            | DateTime? |                                                |
| created_at, updated_at | DateTime  |                                                |

Unique: `(project_id, key)`.

### `Scenario`

| Field              | Type     | Notes                                                          |
| ------------------ | -------- | -------------------------------------------------------------- |
| id                 | String   |                                                                |
| usecase_id         | String   |                                                                |
| type               | Enum     | MAIN_SUCCESS \| EXTENSION.                                     |
| extension_point    | String?  | e.g. `3a` or `*a`. Required when type=EXTENSION.               |
| parent_step_number | Int?     | The step the extension hangs off (1, 2, ...). Or null for `*`. |
| condition          | String?  | Required when type=EXTENSION.                                  |
| outcome            | Enum     | SUCCESS \| FAILURE \| PARTIAL.                                 |
| order_index        | Int      |                                                                |
| created_at         | DateTime |                                                                |

A `UseCase` must have exactly one `Scenario` with `type=MAIN_SUCCESS`.

### `Step`

| Field          | Type     | Notes                                                           |
| -------------- | -------- | --------------------------------------------------------------- |
| id             | String   |                                                                 |
| scenario_id    | String   |                                                                 |
| step_number    | Int      | 1-based within scenario.                                        |
| actor_id       | String   | FK → Actor. Required (system steps reference a "System" actor). |
| action         | String   | Verb phrase.                                                    |
| is_system_step | Boolean  | True when actor_id refers to the System actor.                  |
| notes          | String?  |                                                                 |
| order_index    | Int      |                                                                 |
| created_at     | DateTime |                                                                 |

### `StakeholderInterest`

| Field                | Type     | Notes                                       |
| -------------------- | -------- | ------------------------------------------- |
| id                   | String   |                                             |
| usecase_id           | String   |                                             |
| stakeholder_id       | String   |                                             |
| interest             | String   | What the stakeholder wants protected.       |
| protection_mechanism | String?  | Free-text reference to a step or guarantee. |
| created_at           | DateTime |                                             |

Unique: `(usecase_id, stakeholder_id)`.

### `Revision`

| Field              | Type     | Notes                                                                                |
| ------------------ | -------- | ------------------------------------------------------------------------------------ |
| id                 | String   |                                                                                      |
| entity_type        | Enum     | USECASE \| SCENARIO \| STEP \| ACTOR \| STAKEHOLDER \| GOAL \| STAKEHOLDER_INTEREST. |
| entity_id          | String   |                                                                                      |
| branch_id          | String   | FK → SpecBranch.                                                                     |
| version_number     | Int      | Per (entity_type, entity_id, branch_id).                                             |
| content_hash       | String   | sha256 of canonical JSON.                                                            |
| snapshot           | Json     | Full entity state at this revision.                                                  |
| change_summary     | String?  |                                                                                      |
| author_id          | String   | FK → User.                                                                           |
| parent_revision_id | String?  | For merge ancestry.                                                                  |
| created_at         | DateTime |                                                                                      |

Append-only. Indexed on `(entity_type, entity_id, branch_id, version_number)`.

---

## Concurrency Layer

### `SpecBranch`

| Field             | Type      | Notes                                                         |
| ----------------- | --------- | ------------------------------------------------------------- |
| id                | String    |                                                               |
| project_id        | String    |                                                               |
| name              | String    | e.g. `main`, `session/refund-2026-05-18`. Unique per project. |
| base_branch_id    | String?   | null for `main`.                                              |
| base_revision_ids | Json      | Map: `entity_id` → `revision_id` at branch point.             |
| head_revision_ids | Json      | Map: `entity_id` → current head revision.                     |
| owner_type        | Enum      | HUMAN \| AGENT.                                               |
| owner_id          | String    | User.id (for HUMAN) or WorkSession.id (for AGENT).            |
| purpose           | String?   |                                                               |
| status            | Enum      | ACTIVE \| MERGED \| ABANDONED.                                |
| created_at        | DateTime  |                                                               |
| merged_at         | DateTime? |                                                               |

### `MergeRequest`

| Field            | Type      | Notes                                              |
| ---------------- | --------- | -------------------------------------------------- |
| id               | String    |                                                    |
| source_branch_id | String    |                                                    |
| target_branch_id | String    |                                                    |
| status           | Enum      | OPEN \| APPROVED \| REJECTED \| MERGED \| ABORTED. |
| strategy         | Enum      | FAST_FORWARD \| SQUASH.                            |
| impact           | Json      | Pre-computed `ChangeImpact` payload.               |
| conflicts        | Json      | Conflict descriptors (empty array if clean).       |
| created_by       | String    | FK → User.                                         |
| reviewed_by      | String?   |                                                    |
| created_at       | DateTime  |                                                    |
| resolved_at      | DateTime? |                                                    |

### `WorkSession`

| Field            | Type      | Notes                                                         |
| ---------------- | --------- | ------------------------------------------------------------- |
| id               | String    |                                                               |
| project_id       | String    |                                                               |
| user_id          | String    | The human owner.                                              |
| agent_type       | Enum      | HUMAN \| CURSOR \| CLAUDE_CODE \| WINDSURF \| CODEX \| OTHER. |
| agent_identifier | String?   | e.g. `cursor-claude-bob`.                                     |
| intent           | String    | Free text.                                                    |
| pinned_revisions | Json      | Map: `entity_id` → `revision_id`.                             |
| branch_id        | String?   | FK → SpecBranch (when --auto-branch).                         |
| status           | Enum      | ACTIVE \| COMPLETED \| ABANDONED.                             |
| started_at       | DateTime  |                                                               |
| ended_at         | DateTime? |                                                               |

### `Lock`

| Field              | Type     | Notes                                      |
| ------------------ | -------- | ------------------------------------------ |
| id                 | String   |                                            |
| target_type        | Enum     | USECASE \| SCENARIO \| STEP.               |
| target_id          | String   |                                            |
| lock_type          | Enum     | SOFT \| SEMANTIC \| HARD.                  |
| held_by_session_id | String?  |                                            |
| held_by_user_id    | String   |                                            |
| reason             | String   |                                            |
| acquired_at        | DateTime |                                            |
| expires_at         | DateTime | Default `acquired_at + 30 min`. Renewable. |
| auto_release       | Boolean  | Default true (release on session end).     |

---

## Collaboration Layer

### `Comment`

| Field       | Type      | Notes                        |
| ----------- | --------- | ---------------------------- |
| id          | String    |                              |
| target_type | Enum      | USECASE (MVP: usecase only). |
| target_id   | String    |                              |
| author_id   | String    |                              |
| body        | String    | Markdown.                    |
| resolved    | Boolean   | Default false.               |
| created_at  | DateTime  |                              |
| resolved_at | DateTime? |                              |

---

## Severity Classification Rules

Used by impact analysis. Given a Revision diff:

| Trigger                                                  | Severity     |
| -------------------------------------------------------- | ------------ |
| Typo / whitespace fix in `notes`, `description`.         | COSMETIC     |
| Add `Step` after the last existing step.                 | NON_BREAKING |
| Add a new `Extension` scenario.                          | NON_BREAKING |
| Add a new `StakeholderInterest`.                         | NON_BREAKING |
| Strengthen `success_guarantee` (longer/more conditions). | NON_BREAKING |
| Change `Step.action` (semantic edit).                    | BREAKING     |
| Delete a `Step`.                                         | BREAKING     |
| Change `Step.actor_id`.                                  | BREAKING     |
| Change `Scenario.outcome`.                               | BREAKING     |
| Change `condition` of an existing extension.             | BREAKING     |
| Remove an extension.                                     | BREAKING     |
| Change `primary_actor_id` of a UseCase.                  | BREAKING     |
| Change `trigger`.                                        | BREAKING     |
| Remove a `StakeholderInterest`.                          | BREAKING     |
| Weaken `success_guarantee` (shorter, fewer conditions).  | BREAKING     |
| Change `level` or `scope`.                               | BREAKING     |

Any change to a `Revision` whose entity is `pinned` by an `ACTIVE` session
elevates that session to "affected" in the impact report.

---

## Migration Strategy

- Migrations live in `prisma/migrations/`.
- One migration per logical schema change.
- Migrations are reversible where Prisma allows. Where not, document in the
  migration's README.
- Tests run `prisma migrate deploy` against a fresh testcontainers DB per file
  (or one DB per worker for speed).
