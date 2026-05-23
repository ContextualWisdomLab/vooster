import type { FastifyReply, FastifyRequest } from "fastify";
import { describe, expect, test } from "vitest";
import type { StoredStakeholder } from "../../../src/domain/entities/index.js";
import {
  archiveStakeholder,
  listStakeholders,
  patchStakeholder,
  showStakeholder
} from "../../../src/http/stakeholder-management-routes.js";
import type { StakeholderStore } from "../../../src/ports/stakeholder-store.js";

describe("stakeholder management routes", () => {
  test("lists only active stakeholders", async () => {
    const captured = reply();

    await listStakeholders(
      request(),
      captured.fastifyReply,
      stakeholderStore([
        stakeholder({ id: "stakeholder-1", name: "Legal" }),
        stakeholder({ archived_at: "2026-05-23T00:00:00Z", id: "archived" })
      ])
    );

    expect(captured.body).toMatchObject({
      items: [{ id: "stakeholder-1", name: "Legal" }]
    });
  });

  test("shows stakeholders and reports missing records", async () => {
    const shown = reply();
    await showStakeholder(
      request(),
      shown.fastifyReply,
      stakeholderStore([stakeholder()])
    );

    expect(shown.body).toEqual({
      stakeholder: {
        description: "Legal review",
        id: "stakeholder-1",
        name: "Legal",
        type: "INTERNAL"
      }
    });

    const missing = reply();
    await showStakeholder(request(), missing.fastifyReply, stakeholderStore([]));

    expect(missing.statusCode).toBe(404);
    expect(missing.body).toMatchObject({ title: "Stakeholder not found" });
  });

  test("patches stakeholders with partial updates", async () => {
    const captured = reply();
    const updatedStakeholders: StoredStakeholder[] = [];

    await patchStakeholder(
      request({ body: { name: "Risk", type: "REGULATORY" } }),
      captured.fastifyReply,
      stakeholderStore([stakeholder()], {
        updateStakeholder: captureUpdates(updatedStakeholders)
      })
    );

    expect(updatedStakeholders).toEqual([
      {
        ...stakeholder(),
        name: "Risk",
        type: "REGULATORY"
      }
    ]);
    expect(captured.body).toMatchObject({
      stakeholder: { id: "stakeholder-1", name: "Risk", type: "REGULATORY" }
    });
  });

  test("rejects invalid patch payloads", async () => {
    const captured = reply();

    await patchStakeholder(
      request({ body: { name: "" } }),
      captured.fastifyReply,
      stakeholderStore([stakeholder()], {
        updateStakeholder: () => Promise.resolve()
      })
    );

    expect(captured.statusCode).toBe(400);
    expect(captured.body).toMatchObject({ title: "Invalid stakeholder update" });
  });

  test("requires an existing stakeholder and configured update store", async () => {
    const missing = reply();
    await patchStakeholder(
      request({ body: { description: "Updated" } }),
      missing.fastifyReply,
      stakeholderStore([])
    );

    expect(missing.statusCode).toBe(404);
    expect(missing.body).toMatchObject({ title: "Stakeholder not found" });

    const disabled = reply();
    await archiveStakeholder(
      request(),
      disabled.fastifyReply,
      stakeholderStore([stakeholder()])
    );

    expect(disabled.statusCode).toBe(500);
    expect(disabled.body).toMatchObject({
      title: "Stakeholder updates are not configured"
    });
  });

  test("archives stakeholders", async () => {
    const captured = reply();
    const updatedStakeholders: StoredStakeholder[] = [];

    await archiveStakeholder(
      request(),
      captured.fastifyReply,
      stakeholderStore([stakeholder()], {
        updateStakeholder: captureUpdates(updatedStakeholders)
      })
    );

    const archived = updatedStakeholders[0];
    expect(archived).toMatchObject({ id: "stakeholder-1" });
    expect(archived?.archived_at).toEqual(expect.any(String));
    expect(captured.body).toEqual({
      archived: true,
      stakeholder: { id: "stakeholder-1" }
    });
  });
});

function request(options: { body?: unknown } = {}): FastifyRequest {
  return {
    body: options.body,
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

function stakeholderStore(
  stakeholders: StoredStakeholder[],
  overrides: Partial<StakeholderStore> = {}
): StakeholderStore {
  return {
    findStakeholderById: (_projectId, stakeholderId) =>
      Promise.resolve(
        stakeholders.find((stakeholder) => stakeholder.id === stakeholderId)
      ),
    findStakeholderByName: () => Promise.resolve(undefined),
    listStakeholders: () => Promise.resolve(stakeholders),
    saveStakeholder: () => Promise.resolve(),
    ...overrides
  };
}

function captureUpdates(target: StoredStakeholder[]) {
  return (updated: StoredStakeholder) => {
    target.push(updated);
    return Promise.resolve();
  };
}

function stakeholder(overrides: Partial<StoredStakeholder> = {}): StoredStakeholder {
  return {
    archived_at: null,
    description: "Legal review",
    id: "stakeholder-1",
    name: "Legal",
    project_id: "project-1",
    type: "INTERNAL",
    ...overrides
  };
}
