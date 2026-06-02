---
id: DF-005
title: Run doctor and fix what it reports
persona: AI Coding Agent doing a quality pass
icp_flow: doctor → fix loop
baseline: seeded-rough # repo has use cases with intentional quality issues
case_budget_usd: 2.00
watch:
  - doctor diagnostic accuracy and false-positive rate
  - language-awareness (Korean / concise content not flagged as "too short")
  - whether each diagnostic is recoverable from its own message
---

## Task

This project's specs have accumulated some quality issues. Run `vspec doctor`
to find them, then fix what it reports so the project is in good shape.

Work through the diagnostics doctor surfaces. For each one, make the spec
better — but only change things doctor is actually right about. If a diagnostic
looks like a false positive, say so and explain why rather than degrading a good
spec to satisfy a bad check.

Stop when doctor is clean (or only reports issues you've justified as false
positives), and summarize what you fixed and what you pushed back on.

## Success criteria

- The agent ran `vspec doctor` and acted on its output.
- Real issues were fixed; the agent did not blindly mangle good content to
  silence a questionable check.
- Final state is doctor-clean or has documented, defensible exceptions.

## Quality signals to watch

- Did doctor flag concise or non-English (e.g. Korean) content as a defect?
  That is a language-awareness correctness risk.
- Was each diagnostic self-explanatory and recoverable, or did the agent have to
  guess what doctor wanted?
