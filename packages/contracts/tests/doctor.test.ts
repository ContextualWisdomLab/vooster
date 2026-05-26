import { describe, expect, test } from "vitest";
import { doctorQuerySchema, doctorSuccessResponseSchema } from "../src/index.js";

describe("doctor contracts", () => {
  test("parse project or use case query scopes", () => {
    expect(doctorQuerySchema.parse({ project_id: "project-1" })).toEqual({
      project_id: "project-1"
    });
    expect(doctorQuerySchema.parse({ usecase: "PAY-001" })).toEqual({
      usecase: "PAY-001"
    });
  });

  test("parse successful diagnostic responses", () => {
    expect(
      doctorSuccessResponseSchema.parse({
        checks: [{ id: "project.exists", message: "Project exists.", status: "pass" }],
        scope: { project_id: "project-1" },
        status: "ok",
        suggested_next_actions: [{ command: "vspec usecase list", reason: "Choose." }]
      }).status
    ).toBe("ok");
  });
});
