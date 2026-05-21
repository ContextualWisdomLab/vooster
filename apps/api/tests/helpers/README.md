# tests/helpers

Shared test utilities. **Implement these on iteration 1** (see
`docs/09-bootstrap.md`). Each E2E test imports from here.

## Required Exports

### `server.ts`

```ts
export interface TestServer {
  baseUrl: string;
  fetch(path: string, init?: RequestInit): Promise<Response>;
  stop(): Promise<void>;
}

export async function startServer(): Promise<TestServer>;
```

Boots the Fastify app on an ephemeral port. Internally calls
`composition-root.ts` with the test DI container (testcontainers DB, stub auth,
in-memory clock, etc.).

### `db.ts`

```ts
export async function resetDb(): Promise<void>;
export async function seedFixtures(name: string): Promise<void>;
```

`resetDb` runs `TRUNCATE` on all tables in dependency order. Faster than
`prisma migrate reset` between tests.

### `auth.ts`

```ts
export async function loginAsStub(server: TestServer, email: string): Promise<{
  token: string;
  userId: string;
}>;
```

Implements the stub login path (`?as=<email>`) and returns a usable API token.
Requires `VSPEC_AUTH_STUB=1` in the test environment.

### `factories.ts`

Light data factories for `User`, `Workspace`, `Project`, `Actor`, etc. Use
`factory-girl-ts` or plain functions — agent's choice.

## Test Environment

`tests/setup.ts` should set:

```ts
process.env.VSPEC_AUTH_STUB = "1";
process.env.NODE_ENV = "test";
process.env.VSPEC_LOG_LEVEL = "silent";
```
