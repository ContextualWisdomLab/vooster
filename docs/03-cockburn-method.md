# 03 — Cockburn Use Case Method (Operational Summary)

Source: Alistair Cockburn, *Writing Effective Use Cases* (2000).

This document is the **authoritative interpretation** for vspec. Where Cockburn
allows multiple styles, we pick one and stick to it.

## What a Use Case Is

> "A use case is a contract for the behavior of the system under design, in
> terms of how the primary actor and the system interact to achieve a goal,
> protecting the interests of all stakeholders."

Three operative words:

- **Contract** — not a wish, not a feature; a promise.
- **Goal** — there is a definite ending state to achieve.
- **Stakeholders** — multiple parties have interests to protect.

## Required Fields (Fully Dressed)

vspec stores all of these as first-class fields on `UseCase`:

| Field                  | Required | Notes                                       |
| ---------------------- | -------- | ------------------------------------------- |
| `id`                   | Yes      | e.g. `UC-009`.                              |
| `title`                | Yes      | **Verb phrase** in active voice.            |
| `level`                | Yes      | `SUMMARY` / `USER_GOAL` / `SUBFUNCTION`.    |
| `scope`                | Yes      | Reference to a `SystemBoundary` name.       |
| `primary_actor`        | Yes      | One `Actor`.                                |
| `stakeholders_and_interests` | Yes | List of `StakeholderInterest` (≥1).         |
| `preconditions`        | Yes      | Text list (may be empty list, not null).    |
| `trigger`              | Yes      | Single sentence.                            |
| `main_success_scenario` | Yes     | Numbered list of `Step`s (3–9 typical).    |
| `extensions`           | Recommended | Numbered like `3a`, `*a`, etc.          |
| `success_guarantee`    | Yes      | What is true on success.                    |
| `minimal_guarantee`    | Yes      | What is true even on failure.               |
| `frequency`            | Optional |                                             |
| `priority`             | Optional |                                             |

## Levels (Cockburn's altitude metaphor)

- ☁️ **SUMMARY** — multiple user goals bundled (rare in MVP).
- 🌊 **USER_GOAL** — one actor's single sitting goal. Default. Bulk of vspec's
  use cases live here.
- 🐟 **SUBFUNCTION** — supports user-goal steps; e.g., "Authenticate user."

## Actor vs. Stakeholder

A common confusion. vspec enforces the distinction:

- **Actor** *does* something.
- **Stakeholder** *cares* about something.

A person can be both, but they enter the use case in different roles. Modeling
them separately forces explicit thought about *whose interest is at stake* on
each step.

## Writing Steps

Each `Step` is one short sentence in **active voice, present tense**, structured
as `<actor> <verb-phrase> <object>`.

Good:
- "Customer submits the order."
- "System validates the payment method."

Bad:
- "The order is submitted." (passive)
- "Customer clicks 'Submit'." (UI detail)
- "Customer might submit." (uncertain)

vspec's `Step` entity stores `actor_id` and `action` separately so that voice
violations are detectable and Gherkin generation can know who acted.

## Extensions

Extensions describe **deviations** from the main success scenario.

- Notation: `3a` means "an alternative at step 3." Multiple alternatives at the
  same step are `3a`, `3b`, `3c`. Substeps are `3a1`, `3a2`.
- `*a` means "at any step."
- An extension's first line is the **condition**; subsequent indented lines are
  the **handling**.
- Extensions terminate by either rejoining the main scenario (specify the step
  number) or ending the use case (success/failure).

vspec models extensions as `Scenario` rows with `type=EXTENSION`, plus
`extension_point` (e.g. `3a`), `parent_step_number`, and `condition`.

## Stakeholders & Interests (the unique value)

For every use case, list **at least one** interest per stakeholder. Format:

> *Stakeholder name*: *what they want to be true at the end*

Example:

> - **Customer**: receives correct order, charged correct amount.
> - **Merchant**: payment captured, inventory decremented atomically.
> - **Regulator**: transaction logged for audit.

The system's main success scenario must be designed so that every listed
interest is honored on success. Every extension must specify how each interest
is still (at least minimally) protected.

vspec stores these as `StakeholderInterest` rows linking `UseCase` ↔
`Stakeholder` with an `interest` text and an optional
`protection_mechanism` (free-text reference to a step or guarantee).

## Goals vs. Use Cases (Backlog vs. Spec)

A `Goal` is a **candidate** — something an actor wants to do, identified during
the Actor-Goal List phase. Not all goals become use cases:

- Some are duplicates of existing goals.
- Some are out of scope.
- Some are folded into a larger goal.

A goal that is approved is *promoted* to a `UseCase`. vspec tracks the
promotion link (`Goal.linked_usecase_id`) so the backlog → spec evolution is
visible.

## Format Maturity (Brief → Casual → Fully Dressed)

Cockburn permits writing at three increasing levels of formality. vspec records
the current level on `UseCase.format`:

- `BRIEF` — 2-3 sentences summarizing the main scenario.
- `CASUAL` — free paragraphs covering the scenario and some extensions.
- `FULLY_DRESSED` — all fields populated (the format above).

The system encourages but does not force progression. `vspec doctor` flags
unfinished promotion.

## What vspec Enforces Automatically

| Rule                                                     | Enforced?              |
| -------------------------------------------------------- | ---------------------- |
| Title is a verb phrase (heuristic, warn).                | Warn (`--force` overrides) |
| At least one `StakeholderInterest`.                      | Error on commit.       |
| Main success scenario has ≥1 step.                       | Error.                 |
| Each step has an actor + action.                         | Error.                 |
| Extensions reference an existing step number or `*`.     | Error.                 |
| `success_guarantee` and `minimal_guarantee` are present. | Error.                 |
| Level is one of the three enumerated values.             | Error (Zod).           |
| Steps under 25 words each (warn).                        | Warn.                  |
| Use case has ≤9 main success steps (warn).               | Warn.                  |

## References

- `docs/04-tdd-protocol.md` — for the TDD wrapping all of the above.
- `docs/05-data-model.md` — for the storage form.
- `docs/08-file-format.md` — for the markdown serialization.
