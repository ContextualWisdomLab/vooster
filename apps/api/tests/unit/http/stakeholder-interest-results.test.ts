import type { FastifyReply } from "fastify";
import { describe, expect, test } from "vitest";
import type {
  StoredRevision,
  StoredStakeholder,
  StoredStakeholderInterest
} from "../../../src/domain/entities/index.js";
import {
  sendAddStakeholderInterestResult,
  sendRemoveStakeholderInterestResult
} from "../../../src/http/stakeholder-interest-results.js";

describe("stakeholder interest result responses", () => {
  test("serializes add interest success and validation failures", () => {
    const added = reply();
    sendAddStakeholderInterestResult(added.fastifyReply, {
      nextMissingRoleHint: "No regulatory stakeholder yet.",
      revision: revision(),
      stakeholderInterest: interest(),
      stakeholderInterests: interestRows(),
      status: "ADDED"
    });

    expect(added.statusCode).toBe(201);
    expect(added.body).toMatchObject({
      next_missing_role_hint: "No regulatory stakeholder yet.",
      stakeholder_interest: { id: "interest-1" },
      stakeholder_interests: interestRows()
    });

    const missing = reply();
    sendAddStakeholderInterestResult(missing.fastifyReply, {
      candidateStakeholders: ["Risk"],
      stakeholderName: "Rsk",
      status: "STAKEHOLDER_NOT_FOUND"
    });

    expect(missing.statusCode).toBe(422);
    expect(missing.body).toMatchObject({
      candidate_stakeholders: ["Risk"],
      stakeholder_name: "Rsk",
      title: "Stakeholder name does not resolve"
    });
  });

  test("serializes add interest duplicate, forbidden, and missing use case failures", () => {
    const duplicate = reply();
    sendAddStakeholderInterestResult(duplicate.fastifyReply, {
      existingInterest: "Avoid failed payouts",
      usecaseId: "usecase-1",
      status: "DUPLICATE_INTEREST"
    });

    expect(duplicate.statusCode).toBe(409);
    expect(duplicate.body).toMatchObject({
      code: "STAKEHOLDER_ALREADY_ATTACHED",
      existing_interest: "Avoid failed payouts",
      title: "Stakeholder interest already exists",
      suggested_next_actions: [
        {
          command: "vspec usecase show usecase-1",
          reason: "Review the existing stakeholder interest before changing it."
        }
      ]
    });

    const forbidden = reply();
    sendAddStakeholderInterestResult(forbidden.fastifyReply, { status: "FORBIDDEN" });
    expect(forbidden.statusCode).toBe(403);
    expect(forbidden.body).toMatchObject({
      title: "Contact the workspace owner for access"
    });

    const missing = reply();
    sendAddStakeholderInterestResult(missing.fastifyReply, {
      status: "USECASE_NOT_FOUND"
    });
    expect(missing.statusCode).toBe(404);
    expect(missing.body).toMatchObject({ title: "Use case not found" });
  });

  test("serializes remove interest success with and without warnings", () => {
    const removed = reply();
    sendRemoveStakeholderInterestResult(removed.fastifyReply, {
      noStakeholderInterests: false,
      removedStakeholderInterestId: "interest-1",
      revision: revision(),
      stakeholderInterests: interestRows(),
      status: "REMOVED"
    });

    expect(removed.statusCode).toBeUndefined();
    expect(removed.body).toMatchObject({
      removed_stakeholder_interest_id: "interest-1",
      stakeholder_interests: interestRows()
    });
    expect(removed.body).not.toHaveProperty("warnings");

    const lastRemoved = reply();
    sendRemoveStakeholderInterestResult(lastRemoved.fastifyReply, {
      noStakeholderInterests: true,
      removedStakeholderInterestId: "interest-1",
      revision: revision(),
      stakeholderInterests: [],
      status: "REMOVED"
    });

    expect(lastRemoved.body).toMatchObject({
      warnings: [{ type: "NO_STAKEHOLDER_INTERESTS" }]
    });
  });

  test("serializes remove interest failures", () => {
    const cases = [
      {
        expectedStatus: 403,
        result: { status: "FORBIDDEN" as const },
        title: "Contact the workspace owner for access"
      },
      {
        expectedStatus: 404,
        result: { status: "INTEREST_NOT_FOUND" as const },
        title: "Stakeholder interest not found"
      },
      {
        expectedStatus: 404,
        result: { status: "USECASE_NOT_FOUND" as const },
        title: "Use case not found"
      }
    ];

    for (const item of cases) {
      const captured = reply();

      sendRemoveStakeholderInterestResult(captured.fastifyReply, item.result);

      expect(captured.statusCode).toBe(item.expectedStatus);
      expect(captured.body).toMatchObject({ title: item.title });
    }
  });
});

function reply() {
  const captured: {
    body?: unknown;
    fastifyReply: FastifyReply;
    send: (body: unknown) => unknown;
    statusCode?: number;
  } = {
    fastifyReply: undefined as unknown as FastifyReply,
    send: (body) => {
      captured.body = body;
      return body;
    }
  };
  captured.fastifyReply = {
    code: (statusCode: number) => {
      captured.statusCode = statusCode;
      return captured.fastifyReply;
    },
    send: captured.send
  } as unknown as FastifyReply;
  return captured;
}

function interestRows() {
  return [{ interest: interest(), stakeholder: stakeholder() }];
}

function interest(): StoredStakeholderInterest {
  return {
    id: "interest-1",
    interest: "Avoid failed payouts",
    protection_mechanism: "Audit trail",
    stakeholder_id: "stakeholder-1",
    usecase_id: "usecase-1"
  };
}

function stakeholder(): StoredStakeholder {
  return {
    archived_at: null,
    description: "",
    id: "stakeholder-1",
    name: "Risk",
    project_id: "project-1",
    type: "INTERNAL"
  };
}

function revision(): StoredRevision {
  return {
    change_summary: "Changed stakeholder interest",
    entity_id: "usecase-1",
    entity_type: "USECASE",
    id: "revision-1",
    severity: "NON_BREAKING",
    snapshot: {} as StoredRevision["snapshot"],
    version_number: 2
  };
}
