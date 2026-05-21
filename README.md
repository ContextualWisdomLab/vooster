# vspec

vspec is a Cockburn-style use case management tool for teams coordinating
human and AI contributors around explicit, versioned product behavior. It
ships a Fastify API, Prisma persistence, and an oclif CLI for authoring,
reviewing, and exporting use case specifications.

> [한국어 README](./README.ko.md)

## Install

Use the CLI directly from npm:

```bash
npx vspec --help
```

For repeated use, install it globally:

```bash
npm install -g vspec
vspec --help
```

For development from a clean clone:

```bash
corepack enable
pnpm install
cp .env.example .env
pnpm -r build
```

## Run

Start the optional local Postgres service, then run the development server:

```bash
cp .env.example .env
docker compose up -d db
pnpm run dev
```

The server exposes `GET /healthz` on `http://localhost:8080` unless `PORT` is
set.

## Deploy

Build and run the production-like Docker stack:

```bash
cp .env.example .env
VSPEC_AUTH_STUB=1 docker compose -f docker-compose.prod.yml up -d
```

For real GitHub OAuth, set `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` in the
environment before starting the stack. The compose file provides Postgres via
`DATABASE_URL` and publishes the app on `${VSPEC_DEPLOY_HOST_PORT:-4400}`.

## Documentation

- [Overview](docs/00-overview.md)
- [Architecture](docs/01-architecture.md)
- [Tech stack](docs/02-tech-stack.md)
- [API contract](docs/06-api-contract.md)
- [CLI spec](docs/07-cli-spec.md)
- [Autonomous build harness](docs/build-harness.md)
