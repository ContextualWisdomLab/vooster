import { describe, expect, test } from "vitest";
import {
  stakeholderArchiveResponseSchema,
  stakeholderCreateRequestSchema,
  stakeholderCreateResponseSchema,
  stakeholderListResponseSchema,
  stakeholderPatchRequestSchema,
  stakeholderResponseSchema
} from "../src/index.js";

describe("stakeholder contracts", () => {
  test("parse create defaults and patch payloads", () => {
    expect(
      stakeholderCreateRequestSchema.parse({
        name: "Product Manager",
        type: "INTERNAL"
      })
    ).toEqual({
      description: "",
      name: "Product Manager",
      type: "INTERNAL"
    });

    expect(
      stakeholderPatchRequestSchema.parse({
        name: "Risk",
        type: "REGULATORY"
      })
    ).toEqual({
      name: "Risk",
      type: "REGULATORY"
    });
  });

  test("parse list, show, create, and archive responses", () => {
    const stakeholder = {
      description: "Owns product outcomes",
      id: "stakeholder-1",
      name: "Product Manager",
      type: "INTERNAL"
    };

    expect(
      stakeholderListResponseSchema.parse({ items: [stakeholder] }).items[0]
    ).toEqual(stakeholder);
    expect(stakeholderResponseSchema.parse({ stakeholder }).stakeholder).toEqual(
      stakeholder
    );
    expect(
      stakeholderCreateResponseSchema.parse({
        recommended_next_command: "vspec usecase add-stakeholder",
        revision: { id: "revision-1", version_number: 1 },
        stakeholder: {
          ...stakeholder,
          archived_at: null,
          project_id: "project-1"
        }
      }).revision.version_number
    ).toBe(1);
    expect(
      stakeholderArchiveResponseSchema.parse({
        archived: true,
        stakeholder: { id: "stakeholder-1" }
      })
    ).toEqual({ archived: true, stakeholder: { id: "stakeholder-1" } });
  });
});
