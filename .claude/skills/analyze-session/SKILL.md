---
name: analyze-session
description: >-
  Analyze a Claude Code session transcript (.jsonl under ~/.claude/projects)
  where vspec was used in another repo, then surface prioritized,
  direction-aligned improvements for this vooster repo's API, CLI, contracts,
  web, and local sync surfaces. Use when given a session .jsonl path or asked to
  find vspec dogfood friction from a recorded agent run.
---

# Analyze a vspec dogfood session

Goal: turn one external Claude Code session into a prioritized list of
improvements to this repo. Ground every finding in transcript evidence and align
recommendations with vooster's product direction rather than generic CLI advice.

## 0. Inputs

You need a session JSONL path. If the user gave one, use it. Otherwise ask, or
list candidates:

```bash
ls -lt ~/.claude/projects/*/*.jsonl | head
```

Never read the raw JSONL directly. It can be huge. Always start with the
extractor in step 2.

## 1. Internalize the direction

Read these first and write yourself a five-line "principles I will judge
against" list:

- `docs/00-overview.md` — product intent, personas, and why multi-agent spec
  coordination exists.
- `docs/06-api-contract.md` — API conventions, Problem Details, and the
  expectation that 4xx responses teach the next action.
- `docs/07-cli-spec.md` — current command surface, output formats, and
  agent-format expectations.
- `docs/08-file-format.md` — local markdown and sync expectations.
- `apps/api/src/application/ai-guide.ts` — what a fresh agent is actually told.
- `packages/contracts/src/common.ts` and `apps/cli/src/domain/envelope.ts` —
  shared agent-facing contract surfaces.

Hold these principles while judging:

1. The CLI and API are agent-facing product surfaces, not just developer tools.
2. Errors should be self-teaching: stable `code`, clear message, useful details,
   and `suggested_next_actions` where recovery is possible.
3. The API, CLI, contracts, web, and local sync paths should agree on shape and
   vocabulary; drift is a product bug.
4. Local markdown is part of the workflow, but repeated hand edits to synced spec
   files followed by sync/doctor failures indicate a capability or guidance gap.
5. The product is Korean-first where content quality heuristics are involved;
   English-only linting or title validation is a correctness risk.

## 2. Distill the session

Run:

```bash
.claude/skills/analyze-session/scripts/extract.sh <session.jsonl>
```

Read the whole digest. The assistant narration section is often the richest
signal because the agent may state exactly where it got stuck. Treat narration as
a claim, then verify it against command order, errors, and tool results.

If you need context around a specific failure, use targeted `jq` and `grep`
instead of dumping the raw file:

```bash
jq -r 'select(.type=="user")|.message.content|if type=="array" then (.[]|select(.type=="tool_result")|(if (.content|type)=="array" then (.content[]|select(.type=="text")|.text) else (.content|tostring) end)) else empty end' <session.jsonl> | grep -A8 'YOUR_MARKER'
```

## 3. Friction Signal Catalog

Scan the digest for these patterns:

| Signal in digest | Likely defect |
| --- | --- |
| Same vspec subcommand called many times, mostly failing | The command contract or recovery path is unclear. |
| Repeated `--help` probing for one command | `ai-guide`, help text, or enum hints are incomplete. |
| Raw zod arrays or parser internals in output | API/CLI leaked implementation errors instead of the documented envelope. |
| Problem response lacks `code`, field details, or next actions | Self-teaching error contract gap. |
| Agent output uses title/message matching to recover | Stable machine code is missing or not surfaced. |
| `--format=agent` absent in agent-heavy flows | Guidance or defaults keep the agent away from the structured envelope. |
| Direct edits to `specs/`, `docs/usecases/`, or `.vspec/` followed by sync/doctor/load failures | Local sync or CLI authoring capability gap; identify the missing operation. |
| Enum/format guessing | Help and error details should list allowed values. |
| Doctor false positives on Korean or concise content | Heuristic is not language-aware enough. |
| Binary/setup confusion (`which`, missing `vspec`, package-name mismatch) | Distribution, docs, or `ai-guide` mismatch. |
| Web/API/CLI vocabulary mismatch | Contract drift across `docs/06`, `docs/07`, `packages/contracts`, and app code. |

## 4. Classify by QUANTS

For each finding name the harmed dimension:

- **Q** Quality — wrong output, corrupt sync state, bad spec.
- **A** Attention — user or agent intervention, retry loops, dead ends.
- **N** iNtellectual load — methodology or enum knowledge the tool should carry.
- **T** Tempo — wasted turns/tokens.
- **S** Satisfaction/trust — output requires rereading or manual validation.

## 5. Write Each Finding

For each finding, keep it tight:

1. Title + severity: `P0` corruption/contract break, `P1` agent recovery or core
   workflow bug, `P2` polish/process.
2. Evidence: exact digest line/section, command, and error text.
3. QUANTS dimension(s).
4. Root cause: point to the responsible area after reading it, such as
   `apps/api/src/http/*`, `apps/cli/src/*`, `packages/contracts/src/*`,
   `docs/06-api-contract.md`, `docs/07-cli-spec.md`, or
   `apps/api/src/application/ai-guide.ts`.
5. Recommended direction: API/CLI/contract fix, guide/help fix, sync/file-format
   fix, or deferred product decision.

## 6. Deliver

Lead with a one-paragraph session summary: task, whether it succeeded, headline
friction, rough counts (`vspec usecase ...` attempts, explicit `--format=agent`,
direct spec edits, suggested next actions).

Then list findings severity-first and call out the first three to fix. Do not
modify the session file or external repo. Do not start coding unless the user
explicitly asks.
