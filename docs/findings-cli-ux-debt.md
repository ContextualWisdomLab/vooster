# Findings — CLI UX Debt

_Captured 2026-05-21 during a local dogfood session (boot the server, log in,
create a project). This is a pre-goal scratchpad: it consolidates the gap
between what the CLI **promises** and what it **delivers** so a future goal
(post Goal 5 — Monorepo) can encode it as enumerable gates._

## TL;DR

`docs/07-cli-spec.md` already specifies a polished CLI UX (named profiles,
local credential store, OAuth device flow, a full set of context commands).
The implementation honors only a thin slice of that spec: every command is a
flag-passing HTTP wrapper that requires the caller to manage session and
workspace identifiers by hand. All 35 use cases are marked DONE in
`docs/state/progress.md`, but "DONE" here measures route behavior, not the CLI
experience the spec promised. There is no existing goal that closes this gap.

## The Spec Already Exists

The polished CLI is documented in `docs/07-cli-spec.md`. Highlights it
promises that the current implementation does not yet honor:

- **Global flags** — `--profile`, `--project`, `--session`, `--branch`,
  `--format`, `--quiet`, `--no-color`. Today only a subset of per-command
  flags exist; there is no global context resolution.
- **Local config** — `--profile=<name>` reads from `~/.vspec/config.json`.
  No such file is ever written or read.
- **`vspec login`** — described as a GitHub OAuth **device flow**. Today the
  command requires the caller to pass `--github-code` and to manually capture
  the `Set-Cookie` header from the HTTP response.
- **Context commands** — `vspec logout`, `vspec status`, `vspec init`,
  `vspec workspace switch`, `vspec project switch`, `vspec doctor`,
  `vspec why`, `vspec examples`. None of these commands exist in the CLI
  source tree.
- **`vspec project create --name <n> --key <k>`** — the spec's signature
  carries no workspace or session arguments. Today the command additionally
  requires `--api-url`, `--workspace-id`, and `--session-cookie`, none of
  which the preceding `vspec login` surfaces to the user.

## Rough Edges Observed

Grouped so a follow-up goal can target each as a tranche.

### A. Session and credential management

1. `vspec login` never persists the issued session token. The HTTP response
   sets `vspec_session=...`, but the CLI neither writes it to disk nor prints
   it to stdout, so the caller has to re-do the OAuth flow with `curl` to
   recover the token.
2. Every subsequent command takes `--session-cookie` as a required flag. The
   user is asked to thread a value the CLI itself just discarded.
3. `vspec login` does not print `workspace.id` either, only `workspace.slug`.
   But all later commands require `--workspace-id`, so the spec's
   slug-oriented surface (`workspace switch <slug>`) is not usable yet.
4. There is no `vspec logout` or session-expiry command; there is no way to
   invalidate a token from the CLI.

### B. Missing commands from the spec

The spec lists context and developer-experience commands that have no
implementation today: `logout`, `status`, `init`, `workspace switch`,
`project switch`, `doctor`, `why`, `examples`. The "self-teaching CLI"
differentiator in `docs/00-overview.md` leans on several of these.

### C. Auth flow shape

The spec calls for an OAuth **device flow** (poll-based, no manual code
shuttling). The implementation expects the caller to supply
`--github-code` directly — workable in stub mode (any string works), but
unusable against real GitHub without a separate browser dance the CLI does
not coordinate.

### D. Environment configuration drift

1. `.env.example` ships `VSPEC_PORT` and `VSPEC_API_URL` settings that no
   code reads. The server reads `PORT`; the CLI reads no environment
   variables at all. These are dead config.
2. README documentation referenced a SQLite "no-Docker" path that the Prisma
   schema does not support (the datasource is Postgres-only). The README has
   been corrected for port numbers but the SQLite line should be revisited.

### E. Test-vs-experience asymmetry

`docs/state/progress.md` marks every UC's "CLI E2E" column as ✓. The boot
session showed that a fresh user cannot complete a `login → project create`
flow without escaping to `curl` to capture a cookie. The CLI E2E tests
presumably set those values inside the test harness, so the gate is green
but the user-facing flow is broken. This is the same class of defect Goal 4
named "honest gates" — the gate measures the wrong thing.

## How This Should Become a Goal (After Goal 5)

A future goal (call it _Honest CLI_) should mirror Goal 4's structure:
universal claims, gates that enumerate from a source of truth, no
hand-fixable single examples.

Candidate tranches, kept abstract because Goal 5 will reshape paths:

- **Tranche A — Spec parity by enumeration.** Parse the command list out of
  `docs/07-cli-spec.md` (the spec is the source of truth). Every command
  named there must correspond to an executable subcommand in the CLI
  workspace. Missing commands fail the gate; extras are allowed.
- **Tranche B — Real credential store.** A local config file (path per the
  spec) is written by `vspec login` and read by every other command. The
  gate boots the API in stub mode, runs `vspec login`, then runs
  `vspec project create` in a fresh shell with no inherited environment and
  no extra flags — and expects success.
- **Tranche C — No required `--session-cookie` / `--workspace-id` /
  `--api-url` flags.** Enumerate every command's flag schema; fail if any of
  those three flags are marked required. Optional overrides are fine.
- **Tranche D — Login surfaces actionable context.** The output of
  `vspec login` includes the workspace id (or — better — a `workspace
  switch` recommendation), so users do not need to read the spec to chain
  commands.
- **Tranche E — Meta honesty.** A CLI E2E test counts only if it runs the
  built CLI binary against a real server in a shell with no test-only
  bootstrapping. Generalizes Goal 4's `check-honest-gates.sh` to the CLI
  surface.

## What This Doc Is Not

- Not a goal. `goals/*.md` is enumerated by `scripts/completion-check.sh`
  and requires a matching `.gates.sh`. This file lives under `docs/` on
  purpose so it does not enter the gate pipeline before its time.
- Not an ADR. Decisions are append-only under `docs/decisions/`; this is a
  set of findings, not a decision.
- Not exhaustive. It captures what one boot session surfaced; deeper review
  (especially of the 35 use cases against the spec's command list) will
  surface more.

## Pointer for the Future Author

When Goal 5 (monorepo) lands, the CLI moves under `apps/cli/` and the spec
likely needs path updates. At that point, re-read `docs/07-cli-spec.md`
alongside the relocated CLI source and use this document as the seed list of
gaps to encode as gates.
