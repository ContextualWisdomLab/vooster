# Next Task

_Auto-generated 2026-05-20T20:53:15Z. Do not hand-edit; use blockers.md for overrides._

```
TASK: Finish the CLI split (gate 4.C3).

  These subcommands still have no file under src/cli/commands/:
    impact
    lock
    revert
    who

  When all subcommands have a dedicated file, delete the
  `if (parsed.args.command === …)` chain from src/cli/index.ts. C1
  re-verifies the size cap after the chain is gone.

  Commit:
      green(cli-split): extract <subcommand>
```
