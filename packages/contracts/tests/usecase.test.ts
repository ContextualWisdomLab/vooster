import { describe, expect, test } from "vitest";
import {
  usecaseArchiveQuerySchema,
  usecaseCreateQuerySchema,
  usecaseCreateRequestSchema,
  usecaseCreateResponseSchema,
  usecaseListQuerySchema,
  usecaseListResponseSchema,
  usecaseParamsSchema,
  usecasePatchRequestSchema,
  usecaseRestoreResponseSchema,
  usecaseShowQuerySchema,
  usecaseShowResponseSchema,
  usecaseUpdateResponseSchema
} from "../src/index.js";

describe("usecase contracts", () => {
  test("parses usecase request boundaries", () => {
    expect(
      usecaseCreateRequestSchema.parse({
        primary_actor: "Customer",
        title: "Places an order"
      })
    ).toEqual({
      force: false,
      level: "USER_GOAL",
      primary_actor: "Customer",
      priority: "P2",
      simulate_key_collision_once: false,
      title: "Places an order"
    });
    expect(usecasePatchRequestSchema.parse({ status: "APPROVED" })).toEqual({
      status: "APPROVED"
    });
    expect(usecasePatchRequestSchema.parse({ archived_at: null })).toEqual({
      archived_at: null
    });
    expect(usecaseParamsSchema.parse({ usecaseId: "PAY-001" })).toEqual({
      usecaseId: "PAY-001"
    });
    expect(usecaseCreateQuerySchema.parse({ dry_run: "true" })).toBe(true);
    expect(usecaseArchiveQuerySchema.parse({ purge: "true" })).toBe(true);
    expect(usecaseShowQuerySchema.parse({ format: "agent" }).format).toBe("agent");
    expect(usecaseListQuerySchema.parse({ limit: "10" }).limit).toBe(10);
  });

  test("rejects malformed usecase request boundaries", () => {
    expect(() => usecaseCreateRequestSchema.parse({ title: "" })).toThrow();
    expect(() => usecasePatchRequestSchema.parse({ status: "DONE" })).toThrow();
    expect(() => usecaseParamsSchema.parse({ usecaseId: "" })).toThrow();
    expect(() => usecaseListQuerySchema.parse({ limit: "0" })).toThrow();
  });

  test("parses usecase success responses without dropping stored fields", () => {
    const created = usecaseCreateResponseSchema.parse({
      revision: revision(),
      suggested_next_actions: [
        { command: "vspec usecase show PAY-001", reason: "Open it." }
      ],
      usecase: usecase()
    });

    expect(created.usecase.id).toBe("usecase-1");
    expect(created.revision.version_number).toBe(1);
    expect(usecaseUpdateResponseSchema.parse({ usecase: usecase() }).usecase.key).toBe(
      "PAY-001"
    );
    expect(usecaseRestoreResponseSchema.parse({ usecase: usecase() }).usecase.key).toBe(
      "PAY-001"
    );
    expect(
      usecaseListResponseSchema.parse({
        items: [
          {
            extension_count: 1,
            key: "PAY-001",
            level: "USER_GOAL",
            primary_actor: "Customer",
            scenario_count: 2,
            status: "DRAFT",
            title: "Places an order",
            trigger_excerpt: ""
          }
        ],
        next_cursor: null
      }).items[0]?.scenario_count
    ).toBe(2);
    expect(
      usecaseShowResponseSchema.parse({
        invoked_by: [],
        primary_actor: { name: "Customer" },
        scenarios: [],
        stakeholder_interests: [],
        usecase: usecase()
      }).usecase.key
    ).toBe("PAY-001");
  });
});

function usecase() {
  return {
    archived_at: null,
    current_revision_id: "revision-1",
    format: "BRIEF",
    id: "usecase-1",
    key: "PAY-001",
    level: "USER_GOAL",
    primary_actor_id: "actor-1",
    priority: "P2",
    project_id: "project-1",
    scope: "Checkout",
    status: "DRAFT",
    title: "Places an order"
  };
}

function revision() {
  return {
    entity_id: "usecase-1",
    entity_type: "USECASE",
    id: "revision-1",
    snapshot: usecase(),
    version_number: 1
  };
}
