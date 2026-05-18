---
vspec_format: 1
type: usecase
id: UC-033
key: VSPEC-033
title: Learn how to use vspec (AI agent)
level: USER_GOAL
format: FULLY_DRESSED
status: DRAFT
priority: P0
scope: vspec
primary_actor: ai-coding-agent
---

# Learn how to use vspec (AI agent)

> The bootstrap. A fresh AI coding agent — with no prior context about vspec — runs `vspec ai-guide` as its very first command. The CLI prints a self-contained crash course: why sessions exist, the mandatory pin-first workflow, the `--format=agent` payload contract, the forbidden actions, and a worked end-to-end example. This is how new agents become productive without any external prompt engineering.

## Stakeholders and Interests

- **AI Coding Agent**: gets the entire mental model in one command and learns the canonical safe workflow (pin → edit → propose → commit). _(Protected by: steps 3–5 and Success Guarantee.)_
- **Developer / PM**: doesn't have to maintain bespoke onboarding prompts for every agent product — the spec system teaches the agent itself. _(Protected by: Success Guarantee.)_
- **CI/CD System**: pipelines that bring up a sandbox agent can `vspec ai-guide --format=json | tee` it into the agent's context with zero hand-tuning. _(Protected by: extension 5a.)_
- **Vooster**: keeps agent guidance versioned alongside the CLI; users never see stale guidance referring to retired commands. _(Protected by: step 6 and extension *a.)_

## Preconditions

- The `vspec` CLI is installed and on `PATH`.
- The caller has network access *or* a cached guide from a prior invocation in `~/.vspec/cache/ai-guide-<cli-version>.md`.
- No authentication is required; the guide is public.

## Trigger

The agent (or its operator) runs `vspec ai-guide` or `vspec ai-guide --format=json`.

## Main Success Scenario

1. **AI Coding Agent** invokes `vspec ai-guide` as its first command in a new environment.
2. **System** reads the current CLI version and looks up the matching cached guide in `~/.vspec/cache/`.
3. **System** on cache miss (or version bump) calls the server's guide endpoint, retrieves the markdown payload pinned to this CLI version, and stores it in the cache.
4. **System** prints the guide to stdout — covering: why sessions exist, the mandatory workflow (pin → fetch via `--format=agent` → propose-change → commit), the `--format=agent` payload contract, the forbidden actions (write without pin, force a merge, ignore `suggested_next_actions`), and one worked end-to-end example.
5. **System** at the end of the guide prints `suggested_next_actions` pointing at `vspec login`, `vspec project list`, and `vspec session start`.
6. **AI Coding Agent** parses the guide (it is plain markdown), follows the worked example, and proceeds with its first real task.

## Extensions

### 3a. Network is unreachable and no cached guide exists for the current CLI version

- 3a1. **System** falls back to the previous cached version (any version) and prepends a prominent warning that the guide may be out of date relative to the installed CLI.
- 3a2. **System** suggests `vspec ai-guide` again once connectivity returns.
- (Outcome: PARTIAL — rejoins main at step 4 with a stale-guide warning.)

### 1a. The caller requested `--format=json`

- 1a1. **System** returns the same content as a structured JSON document (`{ "version": "...", "sections": [...], "examples": [...] }`) instead of rendered markdown.
- 1a2. **System** keeps the `suggested_next_actions` array machine-readable.
- (Outcome: SUCCESS — rejoins main at step 6.)

### 2a. The CLI was upgraded since the last invocation

- 2a1. **System** notices the cached guide's `cli_version` field no longer matches.
- 2a2. **System** force-refreshes from the server before printing.
- (Outcome: SUCCESS — rejoins main at step 4.)

### *a. Neither network nor any cached guide is available (cold start, offline)

- *a1. **System** returns exit code 5 and prints a one-line bootstrap pointing at the public guide URL.
- (Outcome: FAILURE — use case ends; agent must regain network access.)

## Success Guarantee

The agent has received a complete, version-matched bootstrap guide on stdout (or in JSON via `--format=json`) that names every command it needs for a safe first task, with `suggested_next_actions` pointing at the next concrete step. The guide is cached so re-invocation is fast and offline-tolerant for the same CLI version.

## Minimal Guarantee

The CLI never prints partial or empty guidance: either the full guide (possibly stale, with a warning) or a clear network-error message with exit code 5. The agent is never left with silent uncertainty about what to do next.

## Notes

- CLI: `vspec ai-guide` (see `docs/07-cli-spec.md` § "Self-Teaching Behaviors").
- Cache path: `~/.vspec/cache/ai-guide-<cli-version>.md` (and `.json`).
- This use case is the explicit answer to overview goal "a new AI agent that has never seen vspec can read `vspec ai-guide` and complete a representative end-to-end task without further documentation" (see `docs/00-overview.md`).
- Companion: UC-034 (fetch a structured spec), UC-035 (propose a change) — the two commands the guide steers the agent toward.
