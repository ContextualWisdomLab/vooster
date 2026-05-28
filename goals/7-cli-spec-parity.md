# Goal 7: CLI Spec Parity (agent envelope, `vspec init`, honest E2E expansion)

> 이 goal을 active로 잡은 에이전트는 먼저
> `guidelines/goal-iteration.md`를 읽어 iteration 프로토콜을 확인할 것.

## Why This Goal Exists

Goal 6은 `vspec login`의 device flow와 credential store를 닫았다. 그러나
`docs/07-cli-spec.md`가 약속한 polished CLI의 세 가지 핵심 surface는
여전히 미구현이거나 부분 구현 상태다:

1. **`--format=agent` envelope.** 스펙 §4가 `{ data, context,
suggested_next_actions, warnings, format_version }` 봉투를 모든
   커맨드의 계약으로 명시한다. 현재 `suggested_next_actions`/`warnings`는
   6개 `*-output.ts` 파일에 산발적으로 존재하고, `format_version`/`context`는
   코드 전체에 0번 등장한다. Goal 6의 scope guard가 의도적으로 펀트했다
   (`goals/6-honest-cli.md:154-156`).
2. **`vspec init`.** 스펙 §"Top-Level Commands"에 _"Initialize a `.vspec/`
   in current dir; bind to a project"_ 로 명시. 현재 미구현. 글로벌
   credential store(`~/.vspec/config.json`)와 별개의 per-repo 바인딩이
   필요하다.
3. **Honest E2E의 좁은 커버리지.** Goal 6의 E1-E4 게이트는 honest
   디렉토리에 `≥1` 시나리오만 요구한다. 그래서 정직성 invariant는 단
   한 파일에만 enforce되고, 나머지 30+ UC 테스트는 inline `fetch()` 시드를
   계속 쓴다 (`grep -c "fetch(" apps/cli/tests/e2e-cli/` = 150).

Goal 7은 이 셋을 닫는다. 마치고 나면:

- 모든 CLI 커맨드의 `--format=agent` 출력이 동일한 envelope을 반환한다
  — 공유 모듈 `apps/cli/src/agent-envelope.ts` 한 군데로 라우팅.
- `vspec init --project <key>`이 cwd에 `.vspec/config.json`을 만들고
  per-repo 바인딩을 영속화한다.
- `apps/cli/tests/e2e-cli-honest/`가 핵심 UC 집합에 대해 inline `fetch`
  없이 CLI 호출만으로 시드 + 검증을 수행한다.

`scripts/check-gate-rigor.sh`가 아래 모든 universal claim에 대응하는
iteration이 gate에 있음을 메타-검증한다. 단일 예시 통과는 금지.

## The Goal

Every condition below holds. Gates iterate; a single example does not
satisfy them.

### Tranche A — `--format=agent` envelope standardization

A1. **`apps/cli/src/agent-envelope.ts` exists and exports
`buildAgentEnvelope`.** Signature accepts `data`, optional `context`,
optional `suggested_next_actions`, optional `warnings`; returns an
object whose top-level keys are exactly
`{data, context, suggested_next_actions, warnings, format_version}`.
The gate greps for `export function buildAgentEnvelope` and asserts
every key appears.

A2. **Legacy agent `format_version` is the integer literal `1`, sourced
only from `agent-envelope.ts`; mutation agent `format_version` is
the integer literal `2`, sourced only from
`apps/cli/src/domain/envelope.ts`.** Any other source file
containing the string `format_version` fails the gate, unless it is
a test asserting an envelope contract.

A3. **Every command file that branches on `format === "agent"` routes
that branch through `buildAgentEnvelope`.** Source of truth:
`grep -rl 'format === "agent"' apps/cli/src/commands/`. The gate
iterates every match and asserts the file imports from
`../agent-envelope` (relative path may vary; the import string is
enumerated).

A4. **Every agent-format output is parseable JSON containing the five
envelope keys.** The gate iterates the same source-of-truth file
list as A3, runs the matching command with `--format=agent --help`
(or the smoke invocation each command file declares), and parses
the stdout. A missing key fails the gate.

A5. **No command emits a top-level field outside the envelope when
`--format=agent` is in effect.** The gate iterates the A3 file list
and asserts every JSON.stringify-style emission in the agent branch
goes through `buildAgentEnvelope` (no direct `JSON.stringify({...})`
calls inside the agent branch).

### Tranche B — `vspec init`

B1. **`apps/cli/src/commands/init.ts` exists, and
`node apps/cli/bin/run.js init --help` exits 0.** The gate runs
`--help` and asserts exit code 0.

B2. **`vspec init --project <key>` writes a per-repo config file at
`./.vspec/config.json`.** The gate creates a tmp directory, runs
`vspec init --project ACME` from inside it, and asserts the file
exists with `{ "current_project_key": "ACME", ... }`. Parent
directory is created if missing.

B3. **`vspec init` without `--project` fails with exit code 2
(validation).** The gate runs it in a tmp directory and asserts
a non-zero exit + a stderr message naming `--project`.

B4. **`vspec init` against an existing `.vspec/config.json` fails
without `--force`.** The gate seeds a tmp directory with a stub
config, runs `vspec init --project X`, and expects exit 6 (local
config / state error per `docs/07-cli-spec.md:325`). With
`--force`, the same invocation succeeds and overwrites.

B5. **Reading the per-repo config is gated through `config-store.ts`.**
The gate greps `apps/cli/src/commands/init.ts` for `readConfig|writeConfig`
from `../config-store` (no direct `fs.writeFile(".vspec/...")` calls
in any command file other than `init.ts` itself, and even there it
goes through the store API). Source of truth: every file under
`apps/cli/src/commands/`.

B6. **The per-repo `.vspec/config.json` is actually read by subsequent
commands run from the same cwd.** "Binding" means the file is not
just written but observed. The gate runs `vspec init --project BOUND`
in a tmp directory, then `vspec status` from the same directory, and
asserts stdout contains `Project BOUND`. Without the
`config-store.ts` cwd-discovery overlay, status falls back to the
global config and the assertion fails.

B7. **`vspec init --help` prints init-specific usage, not the global
`VspecCommand` help dump.** The gate runs `vspec init --help`,
asserts exit 0, and requires stdout to contain both
`vspec init --project` and `force`. A regression to the global
help (which lacks the `--project`/`--force` synopsis lines) fails
the gate.

### Tranche C — Honest E2E coverage expansion

C1. **`apps/cli/tests/e2e-cli-honest/cli-setup.ts` exists.** It exports
a `seedViaCli({ apiUrl, runCli, ...overrides })` helper that
performs login + project + actor + usecase setup using only
`runCli` invocations (no `fetch(` in this file). The gate greps
the file for the export and for `fetch(` (the latter fails the
gate if present).

C2. **Every use case in the honest-required set has a matching honest
test file.** Source of truth: `docs/usecases/UC-*.md` minus the explicit
`HONEST_UC_ALLOWLIST` in `goals/7-cli-spec-parity.gates.sh`. The
allow-list names legacy/planned UCs intentionally outside this goal's
honest-flow surface; any new `docs/usecases/UC-*.md` is included by
default unless it is deliberately added to the allow-list with a
finding. For each derived UC, the gate asserts
`apps/cli/tests/e2e-cli-honest/UC-NNN-*.test.ts` exists. A missing file
fails the gate.

C3. **Zero `fetch(` calls under `apps/cli/tests/e2e-cli-honest/`.** The
gate iterates every `*.ts` in that directory; a single match fails.
(This restates Goal 6 E2 but enforces it on the expanded test set.)

C4. **Every honest test isolates its config via `VSPEC_CONFIG_PATH`.**
The gate iterates every `*.test.ts` in `e2e-cli-honest/` and asserts
each file mentions `VSPEC_CONFIG_PATH`. (Restates Goal 6 A4 across
the expanded set.)

C5. **`scripts/check-honest-cli-e2e.sh` exits 0 on the expanded set.**
The existing script already enforces C1-C4 invariants; the gate
re-invokes it after the new files land. When `VSPEC_GATES_SKIP_DEEP=1`
this sub-check is skipped in `7-cli-spec-parity.gates.sh`; the
invariant is still enforced by `_meta M.3` on every full run.

### Tranche D — Meta: rigor

D1. **`scripts/check-gate-rigor.sh goals/7-cli-spec-parity.md` passes.**
Every universal claim above is paired with a `for|while|find|xargs`
iteration in `goals/7-cli-spec-parity.gates.sh`.

## Scope Guards (additive to Goals 0–6)

- **No new CLI verbs beyond `init`.** `doctor`, `why`, `examples`,
  `explain`, `watch`, `help workflows`, `help concepts` stay queued in
  `docs/findings-cli-ux-debt-followups.md` (created on first hit). A
  follow-up goal enumerates them.
- **No widening by hand-maintained positive list.** Goal 7 derives the
  honest set from `docs/usecases/UC-*.md`; the only manual list is
  `HONEST_UC_ALLOWLIST`, which must name intentionally deferred UCs.
  Migrating the allow-listed UCs to honest mode is a separate effort.
- **Migrations under Tranche C must not introduce new CLI verbs.** If
  a UC's honest test reveals a missing or broken CLI command (e.g.
  `vspec scenario add` cannot be invoked from a script), file the gap
  in `docs/findings/2026-05-21T1856-cli-spec-gaps.md` and add that UC to
  `HONEST_UC_ALLOWLIST` for this goal — do not silently add the verb. The
  finding doc is the queue for the next CLI goal.
- **No `--format=agent` shape divergence per command.** Every command
  routes through `buildAgentEnvelope`. A command that wants a custom
  field puts it inside `data`, never as a top-level key.
- **No reading `~/.vspec/config.json` directly from `init.ts`.** The
  global store is still owned by `config-store.ts`. `init` writes the
  per-repo file via the same module's `writeConfig({ path })` overload
  (add the overload as part of Tranche B if not present).
- **No removing or weakening Goal 6 gates.** Goal 6 E1-E4 and A4 stay
  green. Tranche C strengthens them implicitly by adding more files
  to the directory the existing gates already enforce against.
- **No deleting existing `e2e-cli/` tests.** Their inline `fetch()`
  patterns stay (they document API behavior). The new honest tests
  live in `e2e-cli-honest/`.

## Mandatory First Step (every iteration)

```
bash scripts/diagnose.sh
```

## Mandatory Reading Order

1. `AGENTS.md` — TDD protocol + commit shape.
2. `docs/goal-design.md` — harness contract; case (a)/(b)/(c) rules
   for any prior-gate interaction.
3. `docs/07-cli-spec.md` — the polished CLI surface this goal closes.
   `--format=agent` envelope is §4; `vspec init` is in the top-level
   command list.
4. `goals/6-honest-cli.md` — Goal 7 extends Goal 6's honest invariants;
   read the existing E1-E4 / A4 gates before adding to the same
   directory.
5. `goals/7-cli-spec-parity.md` — this file.
6. `docs/state/next-task.md`
7. `docs/state/blockers.md`
8. Narrow technical reference per task:
   - Tranche A: existing `*-output.ts` files for current shapes.
   - Tranche B: `apps/cli/src/config-store.ts` for the read/write API.
   - Tranche C: `apps/cli/tests/e2e-cli-honest/login-to-usecase.test.ts`
     for the established pattern; `apps/cli/tests/e2e-cli/UC-NNN.test.ts`
     for each derived honest UC to understand what each must seed.

## Recommended Order of Attack

`goals/7-cli-spec-parity.next-task.sh` enforces this order.

1. **Agent envelope module (A1, A2).** Create
   `apps/cli/src/agent-envelope.ts` with `buildAgentEnvelope` +
   `FORMAT_VERSION = 1`. Add a unit test
   `apps/cli/tests/unit/agent-envelope.test.ts`.

2. **Route every agent branch through the envelope (A3, A4, A5).**
   For each match of `grep -rl 'format === "agent"' apps/cli/src/commands/`,
   replace the bespoke shape with `buildAgentEnvelope({ data, ... })`.
   Update each `*-output.ts` consumer signature if needed.

3. **`vspec init` command (B1-B5).** Add `init.ts`. Extend
   `config-store.ts` with a path-aware overload (or new function) so
   `init` writes to `./.vspec/config.json` instead of the global one.
   Add B3/B4 unit tests.

4. **Honest E2E shared setup (C1).** Extract `cli-setup.ts` from the
   existing `login-to-usecase.test.ts` so every new UC test can call
   `seedViaCli(...)` and add only its scenario-specific assertions.

5. **Per-UC honest tests (C2).** For each UC derived from
   `docs/usecases/UC-*.md` minus `HONEST_UC_ALLOWLIST`,
   author `apps/cli/tests/e2e-cli-honest/UC-NNN-<slug>.test.ts`. Each
   test reuses `cli-setup.ts` for shared seed; UC-specific seed steps
   are also CLI calls. If a UC reveals a CLI gap, log to
   `docs/findings/2026-05-21T1856-cli-spec-gaps.md` and add it to
   `HONEST_UC_ALLOWLIST` in the same commit.

6. **Re-run `scripts/check-honest-cli-e2e.sh` (C5).** Confirm the
   expanded set passes.

7. **Rigor sweep (D1).** Run
   `bash scripts/check-gate-rigor.sh goals/7-cli-spec-parity.md`.

8. **Full completion check.** `bash scripts/completion-check.sh` — all
   prior goals must still pass.

## The TDD Loop

Same red → green → refactor as prior goals. Reusable scopes:

- `feat(cli): <description>` — envelope module, init command
- `refactor(cli): <description>` — routing existing commands through
  the envelope module
- `test(cli-honest): <description>` — new per-UC honest tests
- `test(cli): <description>` — envelope module unit tests, init unit
  tests
- `chore(cli): <description>` — config-store path overload, helper
  extraction

## Forbidden Actions (additive to Goals 0–6)

- Adding `format_version` as a string literal anywhere. It is the
  integer `1` and lives only in `agent-envelope.ts`.
- Adding top-level keys to the agent envelope beyond the five spec'd
  ones. Custom payload goes inside `data`.
- Calling `JSON.stringify` directly in any command's agent branch.
  All agent-format output flows through `buildAgentEnvelope`.
- Reading or writing `./.vspec/config.json` from any file other than
  `init.ts` (which itself goes through `config-store.ts`).
- Adding any new test under `e2e-cli-honest/` that calls `fetch(`. The
  honest invariant is the whole point of the directory.
- Silently introducing a new CLI verb during Tranche C UC migrations.
  Log the gap to `docs/findings/2026-05-21T1856-cli-spec-gaps.md` and skip the UC.
- Touching prior goals' `.md` text or `.gates.sh` files. Goal 7 is
  purely additive — see the self-audit in the file header.

## Completion Check

```
bash scripts/completion-check.sh
```

Exit 0 only when goals 0, 1, 2, 3, 4, 5, 6, and 7 all pass their
gates.

## Now Begin

Run: `bash scripts/diagnose.sh`
