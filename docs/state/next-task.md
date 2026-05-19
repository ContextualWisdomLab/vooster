# Next Task

_Auto-generated 2026-05-19T08:29:24Z. Do not hand-edit; use blockers.md for overrides._

```
TASK: Scaffold the vspec CLI binary (gate 1.3).
  - Read: goals/1-runnable.md §3, docs/07-cli-spec.md.
  - Create bin/run.js (oclif entrypoint, calls @oclif/core run()).
  - Add to package.json: "bin": { "vspec": "./bin/run.js" }.
  - Create src/cli/index.ts root command (just shows --help and version).
  - Verify: node bin/run.js --help
  - Commit: "setup(cli): oclif scaffold"
```
