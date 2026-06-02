---
id: DF-006
title: Cold-start discovery — no instructions, only the tool
persona: AI Coding Agent dropped into an unfamiliar repo
icp_flow: cold-start discovery
baseline: empty
case_budget_usd: 2.00
watch:
  - self-teaching surface: ai-guide / help / error next-actions
  - turns-to-first-success (tempo)
  - guessing vs. being told (enum/format/command discovery)
---

## Task

You have just been dropped into this repo. There is a CLI called `vspec`
available on the PATH, and the team apparently uses it to manage software
specifications — but there is no project documentation telling you how.

Figure out what `vspec` is for and use it to record one use case for a feature
of your choosing for a simple **to-do list app** (e.g. "User adds a task").

You will have to discover the workflow yourself from the tool. Stop when you've
recorded a use case, and summarize how you figured out the workflow and where
the tool helped or left you guessing.

## Success criteria

- Starting from zero instructions, the agent recorded one valid use case.
- The agent's path was driven by the tool's own affordances (`vspec ai-guide`,
  `--help`, error `suggested_next_actions`), not by trial-and-error guessing.

## Quality signals to watch

- How many failed commands / `--help` probes before first success? High counts
  mean `ai-guide` or help text is incomplete.
- Did errors carry stable `code` + `suggested_next_actions`, or did the agent
  recover by matching on human message text?
- Did the agent ever guess an enum/format value the tool should have listed?
