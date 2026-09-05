# vooster — vspec

[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/ContextualWisdomLab/vooster)

`vspec` is a Cockburn-style use-case management system for teams coordinating human developers and parallel AI coding agents around explicit, versioned product behavior.

## Product responsibility

vooster owns the lifecycle of structured use cases and the collaboration state around them: actors, stakeholders, goals, scenarios, revisions, specification branches, impact-aware merges, and agent work-session pins. It does not replace source-control hosting, CI execution, coding-agent runtimes, or merge authority in downstream implementation repositories.

## Start from source

This organization copy is a source/development tree rather than evidence of a published npm package or GitHub release. From a clean checkout:

```bash
corepack enable
pnpm install
pnpm -r build
node apps/cli/bin/run.js --help
```

Run the local API with the bundled PostgreSQL service:

```bash
cp .env.example .env
docker compose up -d db
pnpm run dev
```

## Architecture

- Fastify API for specification and collaboration workflows.
- Prisma-backed PostgreSQL persistence.
- oclif CLI exposed as the `vspec` command from the repository launcher.
- Shared TypeScript workspace contracts for API/CLI behavior.
- Repository-local Markdown synchronization for Git-native workflows.

For details, see [Architecture](01-architecture.md), [Tech stack](02-tech-stack.md), [API contract](06-api-contract.md), and [CLI specification](07-cli-spec.md).

## Verification

Use the repository verification entry point before treating a source revision as integration-ready:

```bash
pnpm run verify
```

An unchanged exact revision must also satisfy the repository's live GitHub checks and review requirements.

## Release and provenance boundary

There are currently no GitHub Releases in this repository. The source preserves the upstream MIT license and upstream copyright notice; ContextualWisdomLab modifications do not replace that provenance. Third-party packages, images, services, and hosted dependencies retain their own terms.

## Documentation

- [Product overview](00-overview.md)
- [Architecture](01-architecture.md)
- [Tech stack](02-tech-stack.md)
- [API contract](06-api-contract.md)
- [CLI specification](07-cli-spec.md)
- [Build harness](build-harness.md)
- [Ask DeepWiki](https://deepwiki.com/ContextualWisdomLab/vooster)

This file is a Pages-ready documentation source. It is not evidence that GitHub Pages is published; publication is complete only after repository settings and the live HTTPS site are verified.
