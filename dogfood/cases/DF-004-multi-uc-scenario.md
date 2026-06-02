---
id: DF-004
title: Author a multi-use-case feature with shared actors
persona: AI Coding Agent scoping a larger feature
icp_flow: multi-UC scenario
baseline: seeded-small
case_budget_usd: 2.50
watch:
  - actor/stakeholder modeling across multiple use cases
  - Cockburn fidelity (levels, stakeholders, interests) at scale
  - keeping a coherent set rather than disconnected fragments
---

## Task

The team is adding **shared budgets**: a user can invite a partner to a shared
budget, and both can log expenses against it. This spans more than one use case.

Model this feature in `vspec`. At minimum capture:

- "User invites a partner to a shared budget"
- "Partner accepts a shared-budget invitation"
- "User logs an expense against a shared budget"

Use the right actors (e.g. the inviting user, the partner) and keep them
consistent across the use cases. Where vspec supports stakeholders/interests or
use-case levels, use them to keep the set coherent.

Stop when the feature is modeled as a coherent set of use cases with shared
actors, and summarize the structure.

## Success criteria

- Three related use cases exist and share actors consistently (no per-UC
  duplicate actors for the same role).
- The set reads as one feature, not three unrelated fragments.
- Cockburn structure (actors, and levels/stakeholders where supported) is used,
  not flattened into prose.

## Quality signals to watch

- How much intellectual load did the tool carry vs. the agent having to invent
  methodology (levels, stakeholder modeling) itself?
- Did cross-use-case consistency require manual bookkeeping the tool should
  have provided?
