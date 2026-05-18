# 00 — Overview

## What vspec Is

**vspec** is a SaaS for managing software specifications using Alistair
Cockburn's use case methodology, designed from day one for environments where a
human user collaborates with multiple parallel AI coding agents.

It is consumable through:

- A web UI (read, review, merge).
- A CLI (`vspec ...`) — the primary surface for both humans and AI agents.
- A REST API (used by CLI, web, CI, and custom integrations).
- Local markdown files (`specs/*.md`) synced bidirectionally with the server.

## Why It Exists

Modern AI-assisted development frequently runs **6+ concurrent coding agent
sessions**, each editing different parts of a system. Existing spec tools
(Notion, Confluence, Linear) assume human-paced, human-only collaboration and
break down under this load:

- They have no notion of a "pinned" snapshot, so an agent's spec context shifts
  out from under it mid-task.
- They lack semantic change tracking — a renamed step silently invalidates the
  Gherkin tests that an agent was implementing against.
- They allow conflicting edits without warning, expecting humans to coordinate.

vspec treats the user environment as a **distributed multi-agent system** and
makes that a first-class concern of the data model and workflow.

## The Pitch

> Spec first, then tests, then code. Pin a stable spec snapshot per agent
> session so 6+ agents can work in parallel without invalidating each other's
> completion conditions. Merge changes through a Git-like branch model with
> automatic impact analysis.

## Core Differentiators

1. **Cockburn fidelity.** Stakeholders, interests, levels, extensions are
   first-class entities, not free-form text.
2. **Snapshot pinning per session.** Each agent works against an immutable
   revision; spec edits elsewhere cannot break its in-flight work.
3. **Spec branches and impact-aware merges.** Branch isolation by default;
   conflicts surface only at merge time and are classified COSMETIC /
   NON_BREAKING / BREAKING.
4. **Three-level locks.** SOFT (informational), SEMANTIC (block meaning
   changes), HARD (block all changes).
5. **Self-teaching CLI.** Every error includes the next recommended command;
   `--format=agent` outputs JSON plus `suggested_next_actions`; `vspec ai-guide`
   exists.
6. **File-first workflow.** Specs live as markdown in the repo and sync to the
   server, so AI coding agents read and write them with their existing
   filesystem tools.

## Primary Personas

| Persona            | Role                                            |
| ------------------ | ----------------------------------------------- |
| Human Developer/PM | Authors and reviews specs; supervises agents.   |
| AI Coding Agent    | Implements code and tests against pinned specs. |
| Workspace Admin    | Manages members, API keys, billing.             |
| CI/CD System       | Syncs Gherkin, detects spec drift.              |

## MVP Scope at a Glance

- **16 domain entities** (Workspace, Project, User, Membership, UseCase, Actor,
  Scenario, Step, Stakeholder, StakeholderInterest, Goal, Revision, WorkSession,
  SpecBranch, MergeRequest, Lock, Comment).
- **35 use cases** across 7 categories (auth, project, use case authoring,
  concurrency, collaboration, output, AI-agent).
- **CLI + REST API + minimal Web UI + local file sync.**
- **GitHub OAuth only** for auth.
- **Single-level branches** (main + feature; no nested branches).
- **Rule-based impact analysis** (AI semantic diff is post-MVP).

Explicitly **out of scope** for MVP: Glossary, Tag, Template, Review/Approval
workflow, Webhook, AuditLog (UI), ExternalLink, Attachment, Team entity,
multi-step branches, MCP server (Track C), AI-generated suggestions, web
WYSIWYG editor, mobile, billing, i18n.

## What Success Looks Like (MVP Done)

1. Six concurrent agent sessions can be active without spurious conflicts.
2. The vspec team can register and edit vspec's own 35 use cases inside vspec
   (self-dogfooding).
3. A new AI agent that has never seen vspec can read `vspec ai-guide` and
   complete a representative end-to-end task without further documentation.
4. All E2E tests in `tests/e2e/UC-*.test.ts` pass.
5. `scripts/completion-check.sh` returns 0.

## How to Navigate This Repository

- Start: `GOAL.md` → `AGENTS.md` → this file.
- Reference: `docs/01-architecture.md` ... `docs/08-file-format.md`.
- Specs: `docs/usecases/UC-*.md` (one per use case).
- State: `docs/state/*` (mutable, agent-managed).
- Decisions: `docs/decisions/ADR-*.md` (immutable, append-only).
- Scripts: `scripts/*.sh` (the agent's hands).
