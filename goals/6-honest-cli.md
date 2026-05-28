# Goal 6: Honest CLI (credential store, device flow, optional flags, spec parity)

## Why This Goal Exists

`docs/07-cli-spec.md` promises a polished CLI: GitHub OAuth **device flow**,
named profiles, a local credential store at `~/.vspec/config.json`, dozens of
context commands. The implementation today is a thin HTTP-flag-passing
wrapper:

- Every non-`login` command requires `--api-url`, `--session-cookie`, and
  `--workspace-id` as **required** flags.
- `vspec login` requires `--github-code`, which the user has to obtain via a
  separate browser dance the CLI does not coordinate.
- The response cookie is captured but discarded — the user must scrape
  `Set-Cookie` from a `curl` to recover the session.
- 35/35 use cases are marked `✓ DONE` in `docs/state/progress.md`, but the
  CLI E2E tests sidestep the flow by calling `fetch()` directly in test
  helpers (`apps/cli/tests/e2e-cli/UC-007.test.ts:128`–`156`,
  `helpers.ts:signup()`). The gates measure command behavior, not the
  user-facing flow they claim to cover.

`docs/findings-cli-ux-debt.md` captures the gap in detail. Goal 6 closes
it. After this goal:

- `vspec login` runs a real GitHub device flow (in stub mode, instantly).
- `vspec` writes `~/.vspec/config.json`.
- A fresh shell with no inherited environment can run
  `vspec project create --name X --key Y` and succeed.
- `apps/cli/tests/e2e-cli-honest/` contains end-to-end scenarios that
  drive only the CLI binary — every test in that directory has zero
  `fetch(` calls.

`scripts/check-gate-rigor.sh` enforces that every universal claim below has
an iterating gate; no hand-fix passes this goal.

## The Goal

Every condition below holds. Gates iterate; a single example does not
satisfy them.

### Tranche A — Credential store + login persistence

A1. **A credential-store module exists at `apps/cli/src/config-store.ts`.**
It exposes `readConfig()` and `writeConfig(partial)` against the file at
`process.env.VSPEC_CONFIG_PATH ?? join(homedir(), ".vspec", "config.json")`.

A2. **The config schema persists every field every later tranche needs.**
Required keys: `api_url`, `session_token`, `current_workspace_id`,
`profile`. The gate parses the type definition and iterates this list.

A3. **`vspec login` writes the credential file on success.** It populates
`api_url`, `session_token` (extracted from the response `Set-Cookie`),
and `current_workspace_id` (the first workspace in the response).

A4. **Tests honor `VSPEC_CONFIG_PATH`.** The CLI E2E helpers set
`VSPEC_CONFIG_PATH` to a tmp file per test. The gate iterates every
`*.test.ts` under `apps/cli/tests/e2e-cli-honest/` and asserts the
helper invocation passes a per-test `VSPEC_CONFIG_PATH`.

### Tranche B — OAuth device flow

B1. **Server endpoint `POST /v1/auth/github/token` exists.** It accepts
`{ access_token }`, verifies the token via `https://api.github.com/user`
(or the stub path), and establishes a vspec session using the existing
`completeOAuth` application path. The gate parses the routes file with
`grep -E "/v1/auth/github/token"`.

B2. **Stub mode accepts `stub-access-token-*` tokens instantly.** When
`VSPEC_AUTH_STUB=1`, any access token starting with `stub-access-token-`
succeeds; the suffix becomes the github id. The gate boots the server
with `authStub: true`, posts `{ access_token: "stub-access-token-x" }`
to the new endpoint, and expects HTTP 200 with a `vspec_session=` cookie.

B3. **CLI module `apps/cli/src/device-flow.ts` exists.** Exports a
`runDeviceFlow({ apiUrl, githubClientId, authStub })` function that
requests a device code from GitHub, prints `user_code` + verification
URL, and polls for the access token honoring `interval`/`expires_in`.
In stub mode the polling interval is 0 and the function returns a
`stub-access-token-*` value without contacting GitHub.

B4. **`--github-code` is gone.** The flag is removed from the global
flag block in `apps/cli/src/index.ts` and from `login.ts`. The gate
greps both files; either survivor fails.

### Tranche C — Optional flags with config fallback

C1. **No command file under `apps/cli/src/commands/` requires
`--api-url`, `--session-cookie`, or `--workspace-id`.** The gate
iterates every `*.ts` in that directory and fails if it sees
`requiredFlag(..., "api-url"|"session-cookie"|"workspace-id")`.

C2. **Each of those three flags is satisfied by the credential file or
by an explicit override.** Resolution order: command-line flag >
`VSPEC_CONFIG_PATH` config > environment variable (`VSPEC_API_URL`
only) > error. The gate iterates the flag list `(api-url
    session-cookie workspace-id)` and confirms each has a fallback path
in `apps/cli/src/flag-values.ts`.

C3. **A test confirms commands succeed without those flags when the
config is populated.** The gate iterates the honest-flow scenarios
(Tranche E) and confirms no invocation of `project create`,
`actor create`, or `usecase create` passes any of the three flags.

### Tranche D — Context commands

D1. **The CLI implements every command in the set
`(logout, status, workspace switch, project switch)`.** The gate
iterates this list and asserts
`node apps/cli/bin/run.js <topic> [<sub>] --help` exits 0 for each.

D2. **`logout` calls `POST /v1/auth/logout` and clears the credential
file.** Server endpoint exists (gate greps the routes file) and
deletes the session token from the in-memory `sessionsByToken` map.

D3. **`status` prints `api_url`, `current_workspace_id`, and `profile`
from the credential file without making a network call.** The gate
runs `status` against a populated config with `--api-url` pointing
at a closed port and expects exit 0.

D4. **`workspace switch <slug>` and `project switch <key>` mutate only
the local credential file.** No network call. The gate sets a tmp
`VSPEC_CONFIG_PATH`, runs each command, and confirms the matching
config field changes.

### Tranche E — Honest E2E

E1. **`apps/cli/tests/e2e-cli-honest/` exists and contains at least one
test file.** The gate counts `*.test.ts` files in that directory;
zero fails.

E2. **No test or helper under `apps/cli/tests/e2e-cli-honest/` calls
`fetch(`.** The gate iterates every `*.ts` in that directory and
greps. A single match fails the gate.

E3. **`scripts/check-honest-cli-e2e.sh` exists and exits 0.** It
enforces E1 and E2 and runs `vitest` on the honest directory.
When `VSPEC_GATES_SKIP_DEEP=1` this sub-check is skipped in
`6-honest-cli.gates.sh`; the invariant is still enforced by
`_meta M.3` on every full (non-shallow) run.

E4. **The honest-flow scenario covers `login → project create → actor
    create → usecase create`, end-to-end, with only `runCli`
invocations.** The gate greps the honest directory for each of
those CLI verbs.

### Tranche F — Meta: rigor

F1. **`scripts/check-gate-rigor.sh goals/6-honest-cli.md` passes.**
Every universal claim above is paired with a `for|while|find|xargs`
iteration in `goals/6-honest-cli.gates.sh`.

## Scope Guards

Same as Goals 0–5 plus:

- **No `--format=agent` payload standardization in this goal.** The spec
  §4 envelope (`{ data, context, suggested_next_actions, warnings,
format_version }`) is a separate concern. Touching every
  `*-output.ts` doubles scope without serving Goal 6's claim.
- **No new spec commands beyond Tranche D's four.** `doctor`, `why`,
  `examples`, `init`, `watch`, and the spec's many `list/show/edit`
  variants are out of scope. A follow-up goal can enumerate from
  `docs/07-cli-spec.md`.
- **No re-introducing `--github-code` as an "escape hatch".** Once B4
  removes it, stub mode is the supported path for tests.
- **No deleting existing CLI E2E tests.** Their inline `fetch()` patterns
  stay (they document API behavior), but no new test in `e2e-cli/` may
  use that pattern. The honest-flow guarantees live in
  `e2e-cli-honest/`.
- **No silencing `check-honest-cli-e2e.sh`** by relaxing its `fetch(`
  grep to "only top-level calls" or similar. If a scenario genuinely
  needs HTTP, it does not belong in the honest directory.
- **No widening `requiredFlag` to accept "config or flag" inside the
  helper while keeping its name.** A function called `requiredFlag` must
  still error when nothing satisfies it. Add a new resolver (e.g.
  `resolveContextFlag`) for the fallback semantics so the name matches
  the behavior.

## Mandatory First Step (every iteration)

```
bash scripts/diagnose.sh
```

## Mandatory Reading Order

1. `AGENTS.md` — TDD protocol + commit shape.
2. `docs/07-cli-spec.md` — the polished CLI surface this goal partially
   honors. Treat as the source of truth for command names and flag
   shapes.
3. `docs/findings-cli-ux-debt.md` — the gap analysis that seeded this
   goal.
4. `goals/6-honest-cli.md` — this file.
5. `docs/state/next-task.md`
6. `docs/state/blockers.md`
7. Narrow technical reference per task:
   - Tranche B: GitHub Device Flow docs
     (`https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps#device-flow`).
   - Tranche C: every command file under `apps/cli/src/commands/`.
   - Tranche E: existing `apps/cli/tests/e2e-cli/helpers.ts` for
     contrast.

## Recommended Order of Attack

`goals/6-honest-cli.next-task.sh` enforces this order.

1. **Server: device-flow endpoint (B1, B2).** Add
   `POST /v1/auth/github/token` reusing `fetchGithubProfile`. Stub mode
   accepts `stub-access-token-*` synchronously.

2. **CLI: device-flow module + login rewrite (B3, B4).** New
   `apps/cli/src/device-flow.ts`; `login.ts` calls it; the
   `--github-code` flag is deleted in the same commit. Migrate
   `apps/cli/tests/e2e-cli/UC-001.test.ts`,
   `UC-002.test.ts`, and `helpers.ts::signup()` to the stub
   access-token path.

3. **Credential store (A1, A2, A3, A4).** Add
   `apps/cli/src/config-store.ts`. `login.ts` writes the file. Tests
   set `VSPEC_CONFIG_PATH` per case.

4. **Optional flags (C1, C2, C3).** Add `resolveContextFlag` to
   `flag-values.ts`. Update every command file. Existing CLI E2E
   tests keep working (flag > config); the honest-flow tests rely on
   the config-only path.

5. **Context commands (D1, D2, D3, D4).** Add `logout`, `status`,
   `workspace switch`, `project switch`. Server-side `POST
/v1/auth/logout` for D2.

6. **Honest E2E (E1, E2, E3, E4).** New
   `apps/cli/tests/e2e-cli-honest/login-to-usecase.test.ts` (or
   similar) covering the full flow. Wire
   `scripts/check-honest-cli-e2e.sh`.

7. **Run `bash scripts/completion-check.sh`.** Goals 0–5 must still
   pass.

## The TDD Loop

Same red → green → refactor as prior goals. Reusable scopes:

- `feat(api): <description>` — new server endpoints (device-flow, logout)
- `feat(cli): <description>` — new CLI commands, modules, behavior
- `refactor(cli): <description>` — required → optional flag conversion
- `test(cli-honest): <description>` — honest-flow scenarios
- `chore(cli): <description>` — config schema, env wiring

## Forbidden Actions (additive to Goals 0–5)

- Re-adding `--github-code` to keep an old test green. Migrate the test.
- Bypassing `runDeviceFlow` in production code by accepting a
  pre-baked access token via a hidden flag. Stub mode is the only
  shortcut; it must be gated on `VSPEC_AUTH_STUB=1` server-side.
- Reading `~/.vspec/config.json` directly from any file other than
  `config-store.ts`. All access goes through the module so test
  isolation via `VSPEC_CONFIG_PATH` actually works.
- Letting `resolveContextFlag` silently fall through to an empty
  string. Resolution failure must throw with an actionable message.
- Adding new CLI E2E tests under `e2e-cli/` that use the legacy
  `fetch()`-in-helpers pattern. New scenarios live in
  `e2e-cli-honest/`.
- Removing or weakening the `fetch(` grep in
  `scripts/check-honest-cli-e2e.sh`.

## Completion Check

```
bash scripts/completion-check.sh
```

Exit 0 only when goals 0, 1, 2, 3, 4, 5, and 6 all pass their gates.

## Now Begin

Run: `bash scripts/diagnose.sh`
