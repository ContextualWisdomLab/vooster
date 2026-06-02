import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, test } from "vitest";
import { authHeaders, sessionApp, validPayload } from "./session-routes-fixtures.js";

let currentApp: FastifyInstance | undefined;

afterEach(() => currentApp?.close());

// Every other behavior of POST /v1/sessions is covered by the real-state
// integration suite in tests/integration/http/session-route.test.ts.
//
// This AUTO_BRANCH_COLLISION case cannot be reproduced through HTTP: the
// auto-branch namer retries with random uuid-derived suffixes, so a real
// collision would require three random names to all already exist. The unit
// forces it by injecting a project store whose findProjectById returns
// undefined only for the branch-creation lookup.
describe("session routes (unreproducible via HTTP)", () => {
  test("maps auto-branch collisions to a conflict problem", async () => {
    currentApp = sessionApp({ project: null });

    const response = await currentApp.inject({
      headers: authHeaders(),
      method: "POST",
      payload: validPayload({ auto_branch: true, branch_name: "agent/session-work" }),
      url: "/v1/sessions"
    });

    expect(response.statusCode).toBe(409);
    expect(response.json<{ title: string }>().title).toBe(
      "Auto branch name is already in use"
    );
  });
});
