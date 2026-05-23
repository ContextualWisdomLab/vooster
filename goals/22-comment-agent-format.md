# Goal 22: Comment Agent Format

> 이 goal을 active로 잡은 에이전트는 먼저
> `guidelines/goal-iteration.md`를 읽어 iteration 프로토콜을 확인할 것.

## Why This Goal Exists

Goal 21 moved `revert` out of the agent-format findings queue. The next small
implemented slice is the comment lifecycle:

```
comment add
comment list
comment edit
comment resolve
comment delete
```

The findings queue currently contains this comment group. This goal promotes
that single use-case lifecycle and leaves unrelated member/API-key, sync,
project/workspace, status, merge, and lock renewal debt queued.

`comment` already exists and has human-output coverage. This goal adds
`--format=agent` for the five implemented comment verbs. Agent mode emits one
JSON envelope write and no human lines.

## Advisor Feedback

This goal incorporates Claude headless feedback recorded at
`.state/harness/advisor/goal-22-comment-agent-format-feedback.md`.

## Self-Audit (per `docs/goal-design.md §5`)

This goal is mostly additive, with one required case (a) Retarget:

- **Retarget:** Gates and next-task shims for Goals 18, 19, 20, and 21 used
  the comment findings bullet as the remaining-debt sentinel. This goal removes
  that bullet, so those files are retargeted to the next unrelated sentinel,
  `lock release`.
- No prior invariant is loosened. The invariant remains "unrelated debt still
  exists"; only the sentinel literal changes.
- No prior goal is superseded.
- Goal 7's grep-based envelope gates discover command files that contain
  `format === "agent"`, so adding a branch in `comment.ts` makes those checks
  cover this command file automatically.
- 2026-05-23 gate trim: the comment-format source/test token greps moved to
  focused Vitest execution. This is an enforcement transfer under
  `docs/goal-design.md §5`: the runtime invariant is unchanged, but tests now
  provide the detailed assertion output instead of `gates.sh` grepping source
  and test text.

## The Goal

All conditions below hold. Goal-local gates execute the focused behavior
proofs and the remaining harness-only sentinel check.

### Tranche A — Harness Sentinel

A1. **Prior findings sentinels are retargeted without weakening their
invariant.** Goal 18, Goal 19, Goal 20, and Goal 21 gate and next-task
files no longer require the comment bullet and instead require the
`lock release` bullet.

### Tranche B — Unit Behavior Proof

B1. **Focused unit behavior proves the comment agent contract.** The unit
proof exercises add, list, edit, resolve, and delete with
`--format=agent`. It parses stdout as one JSON envelope, verifies the
default null context, verifies write/list payload shape, verifies guidance
behavior, verifies empty warnings, and proves agent mode does not emit
human comment lines. It also keeps human lifecycle output covered.

### Tranche C — Honest CLI Proof

C1. **Honest CLI behavior proves the comment lifecycle.** The honest proof
starts a real local API, seeds a project through the CLI, invokes add,
list, edit, resolve, and delete with `--format=agent`, carries the created
comment id through the lifecycle, verifies the same JSON envelope contract,
verifies resolve state, and verifies delete omits human `Deleted true`.

### Tranche D — Rigor

D1. **`scripts/check-gate-rigor.sh goals/22-comment-agent-format.md` passes.**

## Scope Guards

- No member or API-key agent branches.
- No push agent branch.
- No project/workspace/status agent branches in Goal 22; Goal 24 supersedes
  this guard for local context commands.
- No lock release/renew implementation.
- No merge resolve implementation.
- No API response shape change.
- No synthetic `deleted: true` field in agent output.
- No runtime invariant may be weakened to pass this goal.
