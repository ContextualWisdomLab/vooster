// tests/e2e/_template.test.ts
//
// COPY this file to tests/e2e/UC-XXX.test.ts when starting a new UC.
// This file is excluded from the test run (see vitest.config.ts).
//
// Pattern shown below:
//   - Boot the real Fastify server on an ephemeral port per test file.
//   - Reset the testcontainers Postgres between files.
//   - Use the VSPEC_AUTH_STUB=1 helper to authenticate as a fixture user.
//   - Black-box the HTTP API; do NOT import from src/application or src/domain.
//   - One main-scenario test + one test per documented extension.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { startServer, type TestServer } from "../helpers/server.js";
import { resetDb } from "../helpers/db.js";
import { loginAsStub } from "../helpers/auth.js";

let server: TestServer;
let alice: { token: string; userId: string };

beforeAll(async () => {
  server = await startServer();
});

afterAll(async () => {
  await server.stop();
});

beforeEach(async () => {
  await resetDb();
  alice = await loginAsStub(server, "alice@vspec.dev");
});

describe("UC-XXX — <short title>", () => {
  test("main: <describe the happy path>", async () => {
    const res = await server.fetch("/v1/<endpoint>", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${alice.token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        /* request payload */
      })
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toMatchObject({
      /* expected response shape */
    });
  });

  test("Na: <describe the extension condition>", async () => {
    const res = await server.fetch("/v1/<endpoint>", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${alice.token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        /* invalid payload */
      })
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.title).toMatch(/<expected error/i);
    expect(body.suggested_next_actions).toBeInstanceOf(Array);
    expect(body.suggested_next_actions.length).toBeGreaterThan(0);
  });

  test("Mb: <describe the second extension>", async () => {
    // ...
  });
});
