---
id: DF-003
title: Refine an existing use case — add extension and edit steps
persona: AI Coding Agent responding to a requirement change
icp_flow: refine use case
baseline: seeded-small
case_budget_usd: 2.00
watch:
  - editing existing steps without corrupting the spec
  - adding an extension flow as a first-class entity
  - local edit → sync round-trip (semantic change tracking)
---

## Task

Requirements changed on the **"User logs a new expense"** use case in this
project. Two updates are needed:

1. The main success scenario should now include selecting an account (e.g.
   "Cash" or "Card") before the expense is saved.
2. Add a new extension: if the chosen category is over its monthly budget, the
   system warns the user but still allows saving.

Apply both changes to the existing use case. Make sure the change is reflected
everywhere the team would see it (local files and the server), not just edited
in one place and left inconsistent.

Stop when the use case reflects both updates consistently, and summarize what
changed.

## Success criteria

- The existing use case is edited in place (not duplicated).
- The new "over budget" path is captured as a first-class extension.
- Local markdown and server agree after the edit (sync clean, doctor clean).

## Quality signals to watch

- If the agent hand-edited `specs/*.md` directly, did sync/doctor accept it or
  fail confusingly? A failure here points to a missing edit capability or
  guidance gap.
- Did renaming/inserting a step surface any semantic-change tracking, or did it
  silently break references?
