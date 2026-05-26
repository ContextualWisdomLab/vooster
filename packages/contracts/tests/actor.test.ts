import { describe, expect, test } from "vitest";
import {
  actorArchiveResponseSchema,
  actorCreateRequestSchema,
  actorCreateResponseSchema,
  actorListResponseSchema,
  actorPatchRequestSchema,
  actorResponseSchema
} from "../src/index.js";

describe("actor contracts", () => {
  test("parse create defaults and patch payloads", () => {
    expect(
      actorCreateRequestSchema.parse({
        is_human: true,
        name: "Customer",
        type: "PRIMARY"
      })
    ).toEqual({
      aliases: [],
      description: "",
      is_human: true,
      name: "Customer",
      type: "PRIMARY"
    });

    expect(
      actorPatchRequestSchema.parse({
        aliases: ["Buyer"],
        is_human: false,
        type: "SUPPORTING"
      })
    ).toEqual({
      aliases: ["Buyer"],
      is_human: false,
      type: "SUPPORTING"
    });
  });

  test("parse list, show, create, and archive responses", () => {
    const actor = {
      aliases: ["buyer"],
      description: "Places orders",
      id: "actor-1",
      is_human: true,
      name: "Customer",
      type: "PRIMARY"
    };

    expect(actorListResponseSchema.parse({ items: [actor] }).items[0]).toEqual(actor);
    expect(actorResponseSchema.parse({ actor }).actor).toEqual(actor);
    expect(
      actorCreateResponseSchema.parse({
        actor: { ...actor, archived_at: null, project_id: "project-1" },
        recommended_next_command: "vspec stakeholder create",
        revision: { id: "revision-1", version_number: 1 }
      }).revision.version_number
    ).toBe(1);
    expect(
      actorArchiveResponseSchema.parse({
        actor: { id: "actor-1" },
        archived: true
      })
    ).toEqual({ actor: { id: "actor-1" }, archived: true });
  });
});
