# dogfood/ — ICP dogfood loop assets

This directory holds the **test-case and analysis assets** for the dogfood
loop. The loop itself is designed in `docs/dogfood-loop.md` and driven by
`scripts/dogfood/dogfood-cycle.sh` (a standalone codex goal, separate from the
`goals/` build stack).

- `cases/<DF-NNN>-<slug>.md` — one ICP flow per file. The `## Task` section is
  the verbatim prompt handed to `claude -p` inside the separate dogfood repo.
- `rubric.md` — the quality rubric the analyzer scores every session against.
- `schema/findings.schema.json` — the structured-output schema that constrains
  the analyzer's `claude -p --json-schema` call.

These are **not** about vspec building its own specs (that is the build-loop's
`scripts/dogfood-test.sh`). These are about a fresh ICP agent _using_ the
shipped vspec product in a real-feeling repo, so we can watch where the agent
UX and the generated spec quality break down.

## Adding a case

A good case mirrors a real moment in an ICP's lifecycle, gives the agent a
goal (not a command list), and names what we are watching. New cases often come
from `analyze-session` findings on real external sessions — feed observed
friction back as a reproducible case.
