# vooster — vspec

**Cockburn-style use case management for teams coordinating human developers and parallel AI coding agents around explicit, versioned product behavior.**

`vspec` treats software specifications as executable collaboration infrastructure rather than static prose. It gives teams a shared use-case model, revision history, branch/merge semantics, pinned agent work sessions, change-impact evidence, and a CLI/API workflow that can be consumed by humans, CI, and coding agents.

> [한국어 README](./README.ko.md)

## Why it exists

When several coding agents work in parallel, a mutable specification can become a hidden source of race conditions: one agent implements against an assumption another agent has already changed. `vspec` is designed to make that state explicit.

Core product ideas include:

- Cockburn-style actors, stakeholders, goals, scenarios, steps, and extensions as structured domain concepts;
- immutable revision snapshots that can be pinned to an agent work session;
- spec branches and impact-aware merge requests;
- semantic and hard locking for sensitive specification regions;
- local Markdown synchronization so repository-native workflows remain available;
- a CLI designed to return machine-usable output and next-action guidance;
- a REST API and web surface over the same product model.

See the [product overview](docs/00-overview.md) for the full MVP responsibility and non-goals.

## Current status

This ContextualWisdomLab repository is a source/development tree, not evidence of a published npm or GitHub release. The root workspace is `private: true`; the CLI package is `@vooster/cli@0.0.0` and is also private, with the executable command name `vspec`. There are currently no GitHub releases in this repository.

Accordingly, use a source checkout for evaluation. Do **not** assume that the public npm package name `vspec` is produced by this repository merely because the command is named `vspec`.

## Quick start from source

### Prerequisites

- Node.js 20 or newer;
- Corepack;
- pnpm `11.0.5` as pinned by the root package metadata;
- Docker/Compose when using the bundled local PostgreSQL service.

Install and build the workspace:

```bash
corepack enable
pnpm install
pnpm -r build
```

Run the repository CLI directly:

```bash
node apps/cli/bin/run.js --help
node apps/cli/bin/run.js ai-guide
```

The launcher uses built output when available and falls back to the TypeScript source CLI through the repository's `tsx` dependency.

## Run the local service

Create a development environment file, start PostgreSQL, and run the API in development mode:

```bash
cp .env.example .env
docker compose up -d db
pnpm run dev
```

The default service exposes `GET /healthz` on `http://localhost:8080` unless `PORT` is configured differently.

For a production-like local Compose profile:

```bash
cp .env.example .env
VSPEC_AUTH_STUB=1 docker compose -f docker-compose.prod.yml up -d
```

`VSPEC_AUTH_STUB=1` is a development/testing shortcut, not production authentication. For real GitHub OAuth, configure the required GitHub client credentials through the deployment environment rather than committing secrets. The production-like Compose profile supplies PostgreSQL through `DATABASE_URL` and publishes the application on `${VSPEC_DEPLOY_HOST_PORT:-4400}` by default.

## Architecture and integration boundary

The repository is a TypeScript/pnpm workspace built around:

- a Fastify API for specification and collaboration workflows;
- Prisma-backed PostgreSQL persistence;
- an oclif-based CLI whose executable is `vspec`;
- shared workspace contracts used by the API and CLI;
- repository-local Markdown specifications and synchronization workflows.

The product owns use-case/specification lifecycle and collaboration semantics. Git hosting, GitHub OAuth identity, CI execution, coding-agent runtimes, and the implementation repositories that consume a specification remain separate systems. A specification revision can guide implementation, but it does not itself become code-execution or merge authority.

See [Architecture](docs/01-architecture.md), [Tech stack](docs/02-tech-stack.md), [API contract](docs/06-api-contract.md), and [CLI specification](docs/07-cli-spec.md).

## Verification

The root package exposes the repository verification entry point:

```bash
pnpm run verify
```

For focused development, the workspace also provides formatting, linting, type checking, tests, and coverage commands through `package.json`. GitHub Actions carries separate CI and verification workflows; an unchanged exact revision must satisfy the repository's live checks before it is treated as integrated evidence.

## Documentation

| Need | Start here |
| --- | --- |
| Product purpose and personas | [Overview](docs/00-overview.md) |
| Architecture | [Architecture](docs/01-architecture.md) |
| Technology choices | [Tech stack](docs/02-tech-stack.md) |
| HTTP integration | [API contract](docs/06-api-contract.md) |
| CLI behavior | [CLI spec](docs/07-cli-spec.md) |
| Repository-native agent workflow | [Build harness](docs/build-harness.md) |

For repository navigation and contribution rules, start with `GOAL.md` and `AGENTS.md` before changing domain or workflow behavior.

## License and provenance

This repository preserves the existing **MIT License** in [LICENSE](LICENSE), including `Copyright (c) 2026 vibemafiaclub`. The root package metadata likewise declares MIT and still points its repository, issue tracker, and homepage metadata to `vibemafiaclub/vooster`.

That provenance is material: this ContextualWisdomLab repository must not replace the upstream copyright or present upstream-derived source as newly licensed exclusively by ContextualWisdomLab. Modifications remain subject to the preserved MIT terms, including retention of the copyright and permission notice in redistributed copies or substantial portions.

Third-party npm packages, container images, GitHub services, and other external components retain their own licenses and terms. Their presence does not change the repository's preserved upstream MIT grant.
