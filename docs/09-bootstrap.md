# 09 — Bootstrap (First-Iteration Contract)

The very first iteration must produce a repository scaffold that **all later
iterations and scripts depend on**. This document fixes the conventions so the
agent does not re-invent them. Anything stated here is binding.

## Repository Layout (create empty stubs on iteration 1)

```
.
├── package.json
├── tsconfig.json
├── tsconfig.build.json
├── vitest.config.ts
├── eslint.config.js
├── docker-compose.yml
├── .env.example
├── prisma/
│   ├── schema.prisma                # already seeded — extend, do not rewrite
│   └── migrations/                  # populated by `prisma migrate dev`
├── src/
│   ├── index.ts                     # process entry; selects server | cli
│   ├── composition-root.ts          # wires adapters into use case interactors
│   ├── domain/                      # pure types, no I/O
│   ├── application/                 # one use case per file or per folder
│   ├── ports/                       # interfaces only
│   ├── infrastructure/
│   │   ├── prisma/
│   │   ├── github/
│   │   └── filesystem/
│   ├── http/
│   │   ├── server.ts
│   │   └── routes/
│   └── cli/
│       ├── index.ts                 # oclif entry, name = "vspec"
│       └── commands/
└── tests/
    ├── setup.ts
    ├── helpers/
    │   ├── server.ts                # boot ephemeral server
    │   ├── db.ts                    # testcontainers Postgres
    │   ├── auth.ts                  # VSPEC_AUTH_STUB helpers
    │   └── factories.ts
    ├── fixtures/
    ├── unit/
    ├── integration/
    └── e2e/
        ├── _template.test.ts        # already seeded — copy per UC
        └── UC-XXX.test.ts           # one per UC
```

## `package.json` (binding contract)

```json
{
  "name": "@vooster/vspec-cli",
  "private": true,
  "version": "0.0.1",
  "type": "module",
  "bin": { "vspec": "./dist/cli/index.js" },
  "scripts": {
    "build":         "tsc -p tsconfig.build.json",
    "dev":           "tsx watch src/index.ts",
    "start:server":  "node --env-file=.env dist/http/server.js",
    "start:cli":     "node dist/cli/index.js",
    "test":          "vitest run",
    "test:watch":    "vitest",
    "test:coverage": "vitest run --coverage",
    "lint":          "eslint .",
    "format":        "prettier --write .",
    "typecheck":     "tsc --noEmit",
    "prisma:gen":    "prisma generate",
    "prisma:migrate":"prisma migrate dev",
    "prisma:reset":  "prisma migrate reset --force",
    "dogfood":       "bash scripts/dogfood-test.sh"
  }
}
```

`scripts/*.sh` and `scripts/dogfood-test.sh` call these names by hand — do not
rename them.

## `tsconfig.json` (root, for tooling)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "types": ["node", "vitest/globals"]
  },
  "include": ["src", "tests"]
}
```

## `tsconfig.build.json`

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "noEmit": false,
    "outDir": "dist",
    "rootDir": "src",
    "declaration": false
  },
  "include": ["src"]
}
```

## `vitest.config.ts`

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.ts"],
    exclude: ["tests/e2e/_template.test.ts"],
    pool: "threads",
    poolOptions: { threads: { singleThread: false } },
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "json-summary"],
      reportsDirectory: "./coverage",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.d.ts", "src/index.ts", "src/composition-root.ts"],
      thresholds: {
        statements: 90,
        branches: 85,
        functions: 90,
        lines: 90
      }
    }
  }
});
```

## `eslint.config.js`

```js
import boundaries from "eslint-plugin-boundaries";
import tseslint from "typescript-eslint";

export default [
  ...tseslint.configs.recommended,
  {
    plugins: { boundaries },
    settings: {
      "boundaries/elements": [
        { type: "domain",         pattern: "src/domain/**" },
        { type: "ports",          pattern: "src/ports/**" },
        { type: "application",    pattern: "src/application/**" },
        { type: "infrastructure", pattern: "src/infrastructure/**" },
        { type: "http",           pattern: "src/http/**" },
        { type: "cli",            pattern: "src/cli/**" },
        { type: "root",           pattern: ["src/index.ts", "src/composition-root.ts"] }
      ]
    },
    rules: {
      "boundaries/element-types": ["error", {
        default: "disallow",
        rules: [
          { from: "domain",         allow: ["domain"] },
          { from: "ports",          allow: ["domain", "ports"] },
          { from: "application",    allow: ["domain", "ports", "application"] },
          { from: "infrastructure", allow: ["domain", "ports", "infrastructure"] },
          { from: "http",           allow: ["domain", "ports", "application", "http"] },
          { from: "cli",            allow: ["domain", "ports", "application", "cli"] },
          { from: "root",           allow: ["domain", "ports", "application", "infrastructure", "http", "cli", "root"] }
        ]
      }]
    }
  }
];
```

## Environment Variables (canonical names)

| Variable               | Purpose                                                  | Default                                              |
| ---------------------- | -------------------------------------------------------- | ---------------------------------------------------- |
| `DATABASE_URL`         | Postgres connection                                      | (required in non-stub)                               |
| `VSPEC_PORT`           | HTTP port                                                | `4455`                                               |
| `VSPEC_PROFILE`        | CLI profile name                                         | `default`                                            |
| `VSPEC_API_URL`        | Base URL the CLI talks to                                | `http://localhost:4455`                              |
| `VSPEC_AUTH_STUB`      | `1` enables stubbed OAuth (test/dogfood only)            | unset                                                |
| `GITHUB_CLIENT_ID`     | OAuth                                                    | required when `VSPEC_AUTH_STUB` is unset             |
| `GITHUB_CLIENT_SECRET` | OAuth                                                    | required when `VSPEC_AUTH_STUB` is unset             |
| `VSPEC_LOG_LEVEL`      | pino level                                               | `info`                                               |

`VSPEC_AUTH_STUB=1` behavior (binding):

- `POST /v1/auth/github/start` returns a fixed redirect to a local callback URL.
- `GET /v1/auth/github/callback` accepts `?as=<email>` and authenticates as a
  pre-seeded user with that email, creating one if absent.
- The CLI flag `vspec login --stub --as <email>` performs the device-less flow
  end-to-end and writes a session token to the local profile.
- This mode is rejected when `NODE_ENV=production`.

## Health Endpoint (binding)

`GET /v1/health` returns `200 {"status": "ok", "version": "<pkg.version>"}`.
`dogfood-test.sh` polls it.

## The "System" Built-in Actor (binding)

Every project is seeded with one canonical built-in actor:

| Field        | Value                                       |
| ------------ | ------------------------------------------- |
| `name`       | `system`                                    |
| `display`    | `System`                                    |
| `type`       | `SUPPORTING`                                |
| `is_human`   | `false`                                     |
| `aliases`    | `["the system"]`                            |

Created in `UC-004` (project creation), not as a separate UC. Step parser maps
`**System**` to this actor.

## Bootstrap Iteration Plan (the first ~12 commits)

The agent must, in this order:

1. `setup: package.json + tsconfig + scripts`
2. `setup: vitest config + tests/setup.ts + tests/helpers/`
3. `setup: eslint flat config with boundaries`
4. `setup: docker-compose.yml + .env.example wired`
5. `setup: prisma generate (schema is already seeded)`
6. `setup: docker compose up -d db && prisma migrate dev --name initial`
7. `setup: src/ directory stubs (empty index.ts files keep eslint happy)`
8. `setup: src/http/server.ts with /v1/health route`
9. `setup: src/cli/index.ts oclif entry, bin "vspec"`
10. `setup: tests/e2e/_template.test.ts proven against /v1/health`
11. `setup: VSPEC_AUTH_STUB middleware (UC-001 prerequisite)`
12. `red: UC-001 sign up with new GitHub identity creates workspace`

After commit 12, normal TDD cycles begin per `AGENTS.md`.

## What this Document Does NOT Define

- Concrete route handler code → comes via TDD.
- Test fixtures content → per `AGENTS.md` "test plan" phase.
- The 35 UC implementations → that is the whole point of the loop.

If a decision is missing, document an ADR in `docs/decisions/`.
