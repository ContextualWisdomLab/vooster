---
title: Passive-voice step linter false-positives on active step containing a subordinate "is selected" clause
created_at: 2026-06-04T18:11:57Z
resolved: true
priority: P1
source: dogfood-loop cycle 20260604T180511Z
related:
  - docs/dogfood-loop.md
---

# Passive-voice step linter false-positives on active step containing a subordinate "is selected" clause

**TL;DR.** CLI/API fix: scope passive-voice detection to the step's main predicate rather than any embedded "to be + participle" phrase, so requirement-style subordinate clauses ("...is positive and a category is selected") don't trip it. Treat the heuristic as a non-blocking warning by default and/or make it language-aware before it gates non-English content.

Surfaced by the dogfood loop (cycle `20260604T180511Z`). QUANTS: ANT.
Root-cause area: `apps/api step-action validation / passive-voice heuristic (apps/api/src/domain or packages/contracts/src); see docs/07-cli-spec.md. Also a Korean-first correctness risk per rubric principle 5 (English-only grammar heuristic).`. Routing: codex.

## Evidence

Digest cmd 12 step action "validates the amount is positive and a category is selected" → tool result "Error: Step action uses passive voice" (digest line 272/82). The step's main verb ("validates") is active; the flag fires on the subordinate "is positive"/"is selected". Narration line 99-101: the agent reworded to "validates the entry, requiring a positive amount and a selected category" and had to reorder steps. The error did offer a recovery ("Next actions: vspec step add --force - Persist this wording..."), but the rejection itself is a false positive against a good spec.

## Recommendation

CLI/API fix: scope passive-voice detection to the step's main predicate rather than any embedded "to be + participle" phrase, so requirement-style subordinate clauses ("...is positive and a category is selected") don't trip it. Treat the heuristic as a non-blocking warning by default and/or make it language-aware before it gates non-English content.

## Acceptance signal

Re-running the dogfood case that produced this finding no longer
reports it at P0/P1 severity.

Resolved in Goal 41. Verification:

- `bash goals/41-dogfood-passive-voice-step-linter-false-positives-on-activ.gates.sh`
  passed on 2026-06-04T18:37Z.
