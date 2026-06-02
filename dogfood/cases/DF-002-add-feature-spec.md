---
id: DF-002
title: Add a feature spec to an existing project
persona: AI Coding Agent (on an established team)
icp_flow: add feature spec
baseline: seeded-small # repo already has a project + 2-3 use cases synced
case_budget_usd: 2.00
watch:
  - vocabulary/structure consistency with existing specs
  - reuse of existing actors instead of duplicating them
  - --format=agent usage in an agent-heavy flow
---

## Task

This repo already manages its specs with `vspec` and has a few existing use
cases. The team is adding a new feature: **"User exports their expenses to
CSV"**. The export covers a selectable date range and emails a download link.

Add this as a new use case. Reuse the existing actors where they fit rather than
inventing new ones, and keep the structure consistent with the use cases already
in the project.

Stop when the new use case is recorded and consistent with the rest of the
project, and summarize how it connects to what already exists.

## Success criteria

- A new use case for CSV export exists and is consistent in shape with existing
  ones.
- Existing actors are reused (no near-duplicate actor created for the same role).
- The agent inspected current state (e.g. `vspec status`, `vspec actor list`,
  use case list) before authoring.

## Quality signals to watch

- Did the agent discover existing actors/use cases, or author blind and create
  drift/duplicates?
- Did agent-facing output (`--format=agent`) give it the next action, or did it
  fall back to human tables and title-matching?
