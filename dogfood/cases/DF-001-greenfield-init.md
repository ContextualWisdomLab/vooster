---
id: DF-001
title: Greenfield init — first spec from a product brief
persona: AI Coding Agent (acting for a solo founder)
icp_flow: greenfield init
baseline: empty # pristine repo, no .vspec/, no specs/
case_budget_usd: 2.00
watch:
  - cold-start discoverability (how many --help / ai-guide probes before first UC)
  - init → project bind → first use case happy path
  - generated UC Cockburn fidelity (actors, goal level, main success scenario)
---

## Task

You are setting up spec management for a brand-new product called **"Pocket"**,
a personal expense-tracking app. This repo is empty. The team uses `vspec` to
manage software specifications.

Get vspec set up in this repo and author the first use case: **"User logs a new
expense"**. The expense has an amount, a category, and an optional note; logging
should confirm the saved entry. Capture the use case the way vspec expects —
primary actor, the main success scenario, and at least one extension (e.g. a
validation failure).

When you believe the spec is recorded and visible to the team, stop and
summarize what you created and how someone else would view it.

## Success criteria

- vspec is initialized and bound to a project without manual file surgery.
- A use case for "log a new expense" exists in vspec with a primary actor and a
  main success scenario.
- At least one extension/error flow is captured as a first-class extension, not
  prose.

## Quality signals to watch

- Did the agent reach for `vspec ai-guide` / `--help`, and did those teach the
  workflow, or did it guess and fail?
- Did any command leak parser/zod internals instead of a self-teaching error?
- Is the resulting `specs/*.md` well-formed and round-trippable (sync/doctor
  clean)?
