import type { FastifyReply, FastifyRequest } from "fastify";
import { describe, expect, test } from "vitest";
import type { StoredStakeholder } from "../../../src/domain/entities/index.js";
import { archiveStakeholder } from "../../../src/http/stakeholder-management-routes.js";
import type { StakeholderStore } from "../../../src/ports/stakeholder-store.js";

// Every behavior of these routes except this one is covered by the real-state
// integration suite in
// tests/integration/http/stakeholder-management-route.test.ts.
//
// This single case cannot be reproduced through HTTP: the real stakeholder
// store always implements updateStakeholder, so the "updates are not
// configured" guard is only reachable when a store without that method is
// injected directly into the handler.
describe("stakeholder management routes (unreproducible via HTTP)", () => {
  test("rejects archive when the update store is not configured", async () => {
    const captured = reply();

    await archiveStakeholder(
      request(),
      captured.fastifyReply,
      stakeholderStore([stakeholder()])
    );

    expect(captured.statusCode).toBe(500);
    expect(captured.body).toMatchObject({
      title: "Stakeholder updates are not configured"
    });
  });
});

function request(): FastifyRequest {
  return {
    params: { projectId: "project-1", stakeholderId: "stakeholder-1" }
  } as FastifyRequest;
}

function reply() {
  const captured: {
    body?: unknown;
    fastifyReply: FastifyReply;
    statusCode?: number;
  } = {
    fastifyReply: undefined as unknown as FastifyReply
  };
  captured.fastifyReply = {
    code: (statusCode: number) => {
      captured.statusCode = statusCode;
      return captured.fastifyReply;
    },
    send: (body: unknown) => {
      captured.body = body;
      return body;
    }
  } as unknown as FastifyReply;
  return captured;
}

function stakeholderStore(stakeholders: StoredStakeholder[]): StakeholderStore {
  return {
    findStakeholderById: (_projectId, stakeholderId) =>
      Promise.resolve(
        stakeholders.find((stakeholder) => stakeholder.id === stakeholderId)
      ),
    findStakeholderByName: () => Promise.resolve(undefined),
    listStakeholders: () => Promise.resolve(stakeholders),
    saveStakeholder: () => Promise.resolve()
  };
}

function stakeholder(): StoredStakeholder {
  return {
    archived_at: null,
    description: "Legal review",
    id: "stakeholder-1",
    name: "Legal",
    project_id: "project-1",
    type: "INTERNAL"
  };
}
