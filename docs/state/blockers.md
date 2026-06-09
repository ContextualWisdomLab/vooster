# Blockers

_Append-only. Mark resolved with ~~strikethrough~~ rather than deleting._
_Format: `- [YYYY-MM-DD UC-XXX] short description — what was tried — current
state.`_

- ~~**[dogfood:budget]** loop stopped (spent $23.4262 (cap $20.00)) at 2026-06-02T21:35:46Z.~~
  - Resolved: this was caused by integration tests writing `cycle-*` fixture rows
    into `.state/dogfood/ledger.tsv`; tests now use isolated dogfood state/runs
    dirs and the test-only ledger rows were removed.

- ~~**[dogfood:max-cycles]** loop stopped (ran 10 cycles (cap 10)) at 2026-06-02T23:47:32Z.~~
  - See .state/dogfood/ledger.tsv and dogfood/runs/. Design: docs/dogfood-loop.md.
  - Resolved: cycle `20260602T232632Z` had `P0=0 P1=0 P2=6`; triage now
    prioritizes a clean P0/P1 pass over cap enforcement, and the dogfood
    entrypoint exits 0 for the recorded clean cycle.

- **[dogfood:budget]** loop stopped (spent $21.5301 (cap $20.00)) at 2026-06-05T00:40:54Z.
  - See .state/dogfood/ledger.tsv and dogfood/runs/. Design: docs/dogfood-loop.md.
