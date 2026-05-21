# Findings — Harness Performance & Correctness Log

Append-only log of **meaningful changes** observed by `harness-engineer` invocations.
Routine measurements live in `.state/harness/runs/` (gitignored). This file
only captures entries worth keeping in git history.

## When to append

Add a row only if one of these is true:

- **regress** — a correctness or performance regression was detected
- **fix** — a fix landed and re-measurement confirmed impact
- **finding** — a new debt item was queued (also create/update the matching `docs/findings-*.md`)
- **promote** — a finding was promoted to a new goal

Routine "ran audit, nothing changed" runs do **not** belong here. They go to
`.state/harness/runs/` and `.state/harness/last-audit.json`.

## Format

One row per entry. Pipe-delimited. Keep it terse — detail lives in the run
file referenced at the end.

```
YYYY-MM-DD | <kind>    | <scope>        | <summary ≤80 chars, units required> | <run-ref>
```

- `<kind>`: `regress` | `fix` | `finding` | `promote`
- `<scope>`: goal id (`2-shippable`) or `cross-goal` or `harness`
- `<run-ref>`: path under `.state/harness/runs/` or a `docs/findings-*.md` path

## Size discipline

This file is meant to stay scannable. If it passes ~100 entries or the
oldest entry is older than ~6 months, `harness-engineer` proposes moving
the older half to `docs/archive/findings-perf-log-<YYYY>-Q<n>.md` (the
archive move is a normal audit-and-propose change, not auto-executed).

## Log

2026-05-22 | fix      | cross-goal | persistence-matrix split 4-way, beforeAll build dropped, gates re-globbed | 4d90a1c
2026-05-22 | promote  | cross-goal | cli-ux-debt → Goal 6 (honest-cli) shipped; finding doc removed | d086641
2026-05-22 | finding | harness | spec debt queued — case (d) + out-of-scope vs proposed-changes boundary | docs/findings-harness-spec-debt.md
2026-05-22 | finding | cross-goal | D1 prose stale in 4 .md files (doc-lag, not coverage gap); advisor=(d) | .state/harness/advisor/2026-05-21T15:20:52Z-q-d1-regression.md
2026-05-22 | finding | harness | warm run regressed 21s→142s (cache busted between audits; 3 goals cold) | .state/harness/runs/2026-05-21T15:20:52Z.jsonl
2026-05-22 | finding | harness | baseline established; warm=21s cold=105s; 4 correctness gaps found | .state/harness/runs/2026-05-21T15:11:02Z.jsonl

<!-- newest first; first real entry will appear above this comment after the first harness-engineer invocation -->
