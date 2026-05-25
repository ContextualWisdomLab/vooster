# Goal 9: CLI Spec Trim & Read-Path Completion

> 이 goal을 active로 잡은 에이전트는 먼저
> `guidelines/goal-iteration.md`를 읽어 iteration 프로토콜을 확인할 것.

## Why This Goal Exists

`docs/findings/2026-05-21T1856-cli-spec-gaps.md` 는 Goal 7 이 큐잉한 미구현 verb 목록이다.
그 목록을 한 줄씩 검토한 결과 두 클래스로 갈라진다:

1. **Over-engineered surface** — 자기-설명 출구가 다섯 군데로 갈라져 있고
   (`why` / `examples` / `explain` / `help workflows` / `help concepts`),
   같은 의미를 두 번 적은 verb 들 (`usecase search` ↔ `usecase list --q`),
   파일-우선 워크플로와 충돌하는 surface (`usecase edit` 의 `$EDITOR` 분기),
   비용 대비 가치가 0 인 TUI (`watch`). 이들을 MVP 에서 들어내야
   `--help` + agent envelope `suggested_next_actions` + `ai-guide` 의
   세 진입점만 살아남아 doc drift 가 끝난다.
2. **Genuinely useful but unrouted** — `project list`, `actor list/show/edit/archive`,
   `stakeholder list/show/edit/archive`, `goal show/reject`, `usecase set/restore`.
   에이전트 컨텍스트 hydration 과 사람 리뷰의 read path 가 이 verb 들에
   직격이라 dispatcher 에 라우팅이 필요하다.

또한 `vspec doctor` 는 별도 heuristic aggregator 로 키우는 대신 **서버
validator 의 얇은 렌더러** 로 다시 그린다. 동일 룰을 두 곳에서 유지하지
않으려는 결정이다.

마지막으로 Goal 7 의 `--format=agent` envelope 표준화는 envelope branch
를 _가진_ 파일들에만 routing 을 강제한다. user-facing verb 그룹 중
일부 (project/actor/stakeholder/goal/doctor) 가 아직 그 branch 자체를
갖고 있지 않다. Goal 9 는 이 격차를 닫되, 당시 agent-format rollout 에서
명시적으로 제외한 파일은 `EXCLUDED_AGENT_FILES` 로만 관리한다.

Goal 9 가 마치고 나면:

- `docs/07-cli-spec.md` 에 `why`, `examples`, `explain`, `watch`,
  `help workflows`, `help concepts`, `usecase search`, `usecase edit
<KEY>` ($EDITOR 분기) 가 더 이상 등장하지 않는다.
- `docs/findings/2026-05-21T1856-cli-spec-gaps.md` 의 _Missing verbs_ 섹션에서
  드롭된 verb 들과 본 goal 이 구현하는 verb 들이 함께 제거된다.
- `apps/cli/src/index.ts` 가 `NEW_VERBS` 셋 의 모든 verb 를 라우팅한다
  (각각 `--help` exit 0).
- `apps/cli/src/commands/doctor.ts` 가 thin renderer 로 존재한다 — API
  를 호출하고 응답을 포맷팅할 뿐 자체 heuristic literal 을 정의하지
  않는다.
- 위 verb 들 각각이 `apps/cli/tests/e2e-cli-honest/` 안에 honest E2E
  를 갖는다 (Goal 7 C3/C4 honest invariant 를 자동 상속).
- `--format=agent` envelope 분기가 declared user-facing 파일 셋
  (`project.ts`, `actor.ts`, `stakeholder.ts`, `goal.ts`, `doctor.ts`)
  에 존재하고, Goal 7 A3 의 envelope routing 규칙을 자동 만족한다.
- `EXCLUDED_AGENT_FILES` 에 선언된 파일은 envelope 분기를 갖지 않는다.

`scripts/check-gate-rigor.sh` 가 아래 모든 universal claim 에 대응하는
iteration 이 gate 에 있음을 메타-검증한다. 단일 예시 통과는 금지.

## Self-Audit (per `docs/goal-design.md §5`)

이 goal 은 prior goal 의 어떤 invariant 도 약화시키거나 retarget 하지
않는다 — 순수 additive. Goal 23 은 이후 Goal 9 의 예전 member/API-key
scope-down decision 을 supersede 했다.

- **Goal 7 A3/A4/A5** (envelope routing) 은 _agent branch 가 있는 파일_
  을 source of truth 로 enumerate 한다. Goal 9 가 5 개 파일에 분기를
  추가하면 그 파일들이 자동으로 Goal 7 A3 enumeration 에 들어오고
  envelope import 까지 강제된다. Goal 9 E1 은 _어떤 파일이 분기를
  가져야 하는가_ 를 declared 셋으로 추가 enforce 할 뿐이라 Goal 7 의
  계약을 강화하지 약화하지 않는다.
- **Goal 7 C2** 는 `HONEST_UC_SET` 안의 UC-NNN 패턴만 enumerate 한다.
  Goal 9 의 새 honest 테스트는 verb-그룹 단위(`project-list.test.ts`
  같은) 라 C2 enumeration 과 겹치지 않는다.
- **Goal 7 C3/C4** 는 `e2e-cli-honest/` 디렉터리 안의 모든 `*.ts` /
  `*.test.ts` 를 enumerate 한다. Goal 9 의 새 honest 테스트는 이
  invariant 를 자동 상속 (fetch-free + VSPEC_CONFIG_PATH).
- **Goal 7 B5** (only `init.ts` writes `.vspec/`) 는 Goal 9 의 새 verb
  들에 영향 없다 — 그들 중 어느 것도 per-repo config 를 쓰지 않는다.
- 기획 변경/아키텍처 교체/기능 제거 어느 케이스에도 해당하지 않으므로
  `## Supersedes` 섹션은 없다.

dropped verb 들 (`why`, `examples`, …) 은 _어느 prior gate 에도_ gate
입력으로 등장하지 않는다 — Goal 7 Scope Guards 의 prose 에서만 언급될
뿐이다. 본 goal 의 spec 트림은 따라서 prior gate 와 충돌하지 않는다.

## The Goal

Every condition below holds. Gates iterate; a single example does not
satisfy them.

### Tranche A — Spec & findings trim

A1. **Every verb in the declared `DROPPED_VERBS` set is absent from
`docs/07-cli-spec.md`.** Source of truth: the literal array
`     DROPPED_VERBS=(
      "vspec why"
      "vspec examples"
      "vspec explain"
      "vspec watch"
      "vspec help workflows"
      "vspec help concepts"
      "vspec usecase search"
    )
    `
The gate iterates and `grep -F` each token; any hit fails the gate.
`vspec usecase set` is NOT a substring of any token, so removing
`usecase search` does not accidentally take `set` with it.

A2. **The `$EDITOR` form of `vspec usecase edit` is absent from
`docs/07-cli-spec.md`.** The gate greps for the exact phrase
`Opens $EDITOR on the markdown form` (the spec's signature line)
AND for the synopsis `vspec usecase edit <KEY-NNN>`; both must be
gone. `vspec usecase set` survives.

A3. **Every verb in `DROPPED_VERBS` ∪ `{vspec usecase edit, vspec
    usecase search}` is absent from `docs/findings/2026-05-21T1856-cli-spec-gaps.md`
"Missing verbs" section.** Source of truth: the same array iterated
against the findings file. A finding that says "dropped — see goal
9" is fine _as long as the verb token itself is gone from the
bullet list_; the gate scopes to bullet lines beginning with `-`.

A4. **Every verb in the declared `IN_SCOPE_VERBS` set is absent from
the `docs/findings/2026-05-21T1856-cli-spec-gaps.md` "Missing verbs" section once
the goal completes.** Source of truth: the literal array
`     IN_SCOPE_VERBS=(
      "vspec project list"
      "vspec actor list"
      "vspec actor show"
      "vspec actor edit"
      "vspec actor archive"
      "vspec stakeholder list"
      "vspec stakeholder show"
      "vspec stakeholder edit"
      "vspec stakeholder archive"
      "vspec goal show"
      "vspec goal reject"
      "vspec usecase set"
      "vspec usecase restore"
      "vspec doctor"
    )
    `
Each token must be absent from the bullet list of "Missing verbs."
The finding doc may still mention these verbs in a "Resolved by
Goal 9" footnote (the gate looks only at `-` bullets in the
Missing-verbs section).

### Tranche B — Dispatcher routing for in-scope verbs

B1. **Every verb in `IN_SCOPE_VERBS` is routed in
`apps/cli/src/index.ts`.** The gate iterates the array and for each
`"<topic> <action>"` token greps for both `parsed.args.command ===
    "<topic>"` AND `this.argv[1] === "<action>"` in the dispatcher
file. (Top-level verbs like `vspec doctor` use the single-token
pattern `parsed.args.command === "doctor"`.) A token without a
matching dispatch entry fails the gate.

B2. **Every verb in `IN_SCOPE_VERBS` exits 0 when invoked with
`--help`.** The gate iterates the array and runs
`node apps/cli/bin/run.js <topic> <action> --help` (or `vspec
    doctor --help`) and asserts exit code 0. (Argument parsing and
flag declarations only — no live server.)

### Tranche C — `doctor` as a thin renderer

C1. **`apps/cli/src/commands/doctor.ts` exists and is registered in
the dispatcher.** The gate asserts the file exists, contains
`export async function runDoctor`, and is referenced by
`apps/cli/src/index.ts`.

C2. **`doctor.ts` fetches its verdict from the API.** The file
contains a call to `fetchJson` (or `fetch(`) targeting a path that
matches `/v1/.*doctor` or `/v1/.*quality`. The gate greps for the
pattern. A `doctor.ts` that computes locally fails the gate.

C3. **`doctor.ts` does not define its own rule set.** The gate
iterates a declared list of forbidden literals
`     FORBIDDEN_DOCTOR_LITERALS=(
      "active voice"
      "verb voice"
      "stakeholder interest"
      "extension outcome"
      "main success scenario has"
      "Cockburn requires"
    )
    `
and fails if any appears in `doctor.ts` body. (These would have
been the heuristic strings if `doctor` were a local aggregator;
the API owns them now.)

C4. **`doctor.ts` is small.** ≤ 120 LOC including imports. The "thin
renderer" invariant is observable at file size. The gate runs
`wc -l apps/cli/src/commands/doctor.ts` and fails > 120.

### Tranche D — Honest E2E for new verbs

D1. **Every verb in `IN_SCOPE_VERBS` has a matching honest test
file under `apps/cli/tests/e2e-cli-honest/`.** The gate iterates
the array and for each `"<topic> <action>"` token asserts a
matching `<topic>-<action>.test.ts` (or `<topic>-read.test.ts` /
`<topic>-edit.test.ts` covering multiple actions of the same
topic) exists in the directory. Specifically, the gate accepts
either: - `<topic>-<action>.test.ts` (e.g. `project-list.test.ts`,
`usecase-set.test.ts`), or - any `<topic>-<group>.test.ts` whose body contains the literal
`runCli([` followed within the same file by the action
keyword (the gate parses each candidate). This lets
`actor-read.test.ts` cover both `actor list` and `actor show`
in one file.

Goal 7 C3/C4 continue to enforce the honest-test hygiene boundary for
every file in `apps/cli/tests/e2e-cli-honest/`, including the files that
Goal 9 requires here.

### Tranche E — Agent envelope rollout to user-facing files

E1. **Every file in the declared `USER_FACING_AGENT_FILES` set has a
`format === "agent"` branch routed through `buildAgentEnvelope`.**
Source of truth: the literal array
`     USER_FACING_AGENT_FILES=(
      apps/cli/src/commands/project.ts
      apps/cli/src/commands/actor.ts
      apps/cli/src/commands/stakeholder.ts
      apps/cli/src/commands/goal.ts
      apps/cli/src/commands/doctor.ts
    )
    `
The gate iterates and asserts each file contains both
`format === "agent"` and an import from `../agent-envelope`. (Goal
7 A3 strengthens this further: once the branch exists, the
envelope routing is auto-enforced.)

E2. **Every file in the declared `EXCLUDED_AGENT_FILES` set does NOT
have a `format === "agent"` branch.** Source of truth:
`     EXCLUDED_AGENT_FILES=()
    `
The gate iterates and asserts no file contains
`format === "agent"`. Goal 23 superseded the earlier member/API-key
scope-down decision, so the set is currently empty.

### Tranche F — Meta: rigor

F1. **`scripts/check-gate-rigor.sh goals/9-cli-trim.md` passes.**
Every universal claim above is paired with a
`for|while|find|xargs` iteration in `goals/9-cli-trim.gates.sh`.

## Scope Guards (additive to Goals 0–8)

- **No re-introducing dropped verbs.** `why`, `examples`, `explain`,
  `watch`, `help workflows`, `help concepts`, `usecase search`, and
  `usecase edit <KEY>` ($EDITOR flow) stay out of both spec and
  dispatcher. Re-introduction requires a _new_ goal with explicit
  rationale.
- **No new CLI verbs beyond `IN_SCOPE_VERBS`.** If an honest test
  reveals a missing verb, log it in `docs/findings/2026-05-21T1856-cli-spec-gaps.md`
  and stop — do not silently widen the dispatcher inside this goal.
- **No envelope branch in `EXCLUDED_AGENT_FILES`.** Goal 23 superseded the
  earlier member/API-key exclusions, so the set is currently empty.
- **No new rule literals in `doctor.ts`.** Validation logic lives on
  the API side. `doctor.ts` calls the endpoint and renders.
- **No widening Goal 7 `HONEST_UC_SET`.** Goal 9's honest tests cover
  _verbs_, not Cockburn UC scenarios. They land in
  `e2e-cli-honest/<topic>-<action>.test.ts` and do not register as
  UC-NNN tests.
- **No touching prior goals' `.md` or `.gates.sh`.** Goal 9 is purely
  additive. The self-audit above confirms no case (a)/(b)/(c)
  applies.
- **No silent merge of "trim" and "complete" commits.** Tranche A
  (spec/findings edits) lands as its own commit family. Tranche B
  (dispatcher routes) is per-verb commits. Tranche C (`doctor`) is a
  feature commit. Tranche D (honest tests) is `test(cli-honest):`
  commits. Tranche E (envelope rollout) is `refactor(cli):` commits.
  Conflating these makes review impossible.

## Mandatory First Step (every iteration)

```
bash scripts/diagnose.sh
```

## Mandatory Reading Order

1. `AGENTS.md` — TDD protocol + commit shape.
2. `docs/goal-design.md` — harness contract; case (a)/(b)/(c) rules.
   Goal 9's self-audit concludes "purely additive"; re-read §5 if you
   are about to touch a prior gate file.
3. `docs/07-cli-spec.md` — the spec being trimmed. Tranche A removes
   lines; do not re-introduce them anywhere else.
4. `docs/findings/2026-05-21T1856-cli-spec-gaps.md` — the queue being resolved.
5. `goals/7-cli-spec-parity.md` — envelope contract and honest-flow
   invariants that Goal 9 extends.
6. `goals/9-cli-trim.md` — this file.
7. `docs/state/next-task.md` and `docs/state/blockers.md`.
8. Narrow technical reference per task:
   - Tranche B: `apps/cli/src/index.ts` for the dispatcher pattern;
     `apps/cli/src/commands/actor.ts` etc. for the run-function shape.
   - Tranche C: `apps/api/src/http/` for an existing quality/doctor
     endpoint (or surface the gap as a finding if it does not exist).
   - Tranche D: `apps/cli/tests/e2e-cli-honest/cli-setup.ts` for
     `seedViaCli`; `apps/cli/tests/e2e-cli-honest/UC-009-usecase.test.ts`
     as a template.
   - Tranche E: `apps/cli/src/commands/usecase.ts` for an existing
     envelope branch; `apps/cli/src/agent-envelope.ts` for the
     `buildAgentEnvelope` signature.

## Recommended Order of Attack

`goals/9-cli-trim.next-task.sh` enforces this order.

1. **Tranche A — trim commits.** Remove dropped-verb lines from
   `docs/07-cli-spec.md`; trim `usecase edit` $EDITOR phrase; update
   `docs/findings/2026-05-21T1856-cli-spec-gaps.md` to remove both dropped and
   in-scope verbs from the Missing-verbs bullet list. Each file edit
   is its own commit:
   - `docs(cli-spec): drop why/examples/explain/watch/help-tree`
   - `docs(cli-spec): drop usecase search & usecase edit editor flow`
   - `docs(findings): trim verbs resolved or dropped by Goal 9`
2. **Tranche C scaffold (`doctor.ts`) first.** Tranche B routing for
   `doctor` depends on this file existing. Author the thin renderer
   targeting `/v1/usecases/:key/doctor` (or whatever the API exposes
   — log a finding if not present).
3. **Tranche B — dispatcher routes.** Per `IN_SCOPE_VERBS`, add the
   `parsed.args.command` / `argv[1]` branch in `apps/cli/src/index.ts`
   and the corresponding `runX` function in the topic file. Ship one
   verb per commit (`feat(cli): route <verb>`).
4. **Tranche D — honest E2E per verb.** For each verb (or per
   verb-group), author `apps/cli/tests/e2e-cli-honest/<file>.test.ts`
   using `seedViaCli`. Commit family: `test(cli-honest):`.
5. **Tranche E — envelope rollout.** For each file in
   `USER_FACING_AGENT_FILES`, add the `format === "agent"` branch +
   `buildAgentEnvelope` import. Goal 7 A3 will start enforcing
   routing the moment the branch exists. Commit family:
   `refactor(cli): route <topic> agent output through buildAgentEnvelope`.
6. **Rigor sweep (F1).** Run
   `bash scripts/check-gate-rigor.sh goals/9-cli-trim.md`.
7. **Full completion check.** `bash scripts/completion-check.sh` —
   goals 0–9 all pass.

## The TDD Loop

Same red → green → refactor as prior goals. Reusable scopes:

- `docs(cli-spec): <description>` — Tranche A spec trim
- `docs(findings): <description>` — Tranche A findings update
- `feat(cli): <description>` — new dispatcher routes, doctor command
- `refactor(cli): <description>` — envelope rollout to existing
  topic files
- `test(cli-honest): <description>` — Tranche D honest tests
- `chore(cli): <description>` — helper additions, run-function
  signature changes

## Forbidden Actions (additive to Goals 0–8)

- Adding any string from `DROPPED_VERBS` back to `docs/07-cli-spec.md`,
  `docs/findings/2026-05-21T1856-cli-spec-gaps.md`, `apps/cli/src/index.ts`, or any
  command file under `apps/cli/src/commands/`.
- Adding a `format === "agent"` branch to `apps/cli/src/commands/member.ts`
  or `apps/cli/src/commands/api-key.ts`.
- Authoring a doctor rule inside `apps/cli/src/commands/doctor.ts` —
  validation lives on the API. Forbidden literals are enumerated in
  Tranche C3.
- Calling `fetch(` from any new file under
  `apps/cli/tests/e2e-cli-honest/`. Honest invariant is total.
- Widening `IN_SCOPE_VERBS` mid-goal without first updating the
  array in `goals/9-cli-trim.gates.sh` AND in this `.md` file (both
  must move together — single source of truth).
- Conflating spec-trim, dispatcher-routes, and envelope-rollout into
  one commit. Review traceability requires the families stay split.
- Touching any prior goal's `.md` text or `.gates.sh` file. Goal 9 is
  purely additive per the self-audit above.

## Completion Check

```
bash scripts/completion-check.sh
```

Exit 0 only when goals 0, 1, 2, 3, 4, 5, 6, 7, 8, and 9 all pass
their gates.

## Now Begin

Run: `bash scripts/diagnose.sh`
