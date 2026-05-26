import { describe, expect, test } from "vitest";
import {
  gherkinExportResponseSchema,
  markdownExportResponseSchema,
  usecaseExportParamsSchema,
  usecaseExportRequestSchema
} from "../src/index.js";

describe("export contracts", () => {
  test("parses shared export request boundaries", () => {
    expect(usecaseExportParamsSchema.parse({ id: "UC-030" })).toEqual({
      id: "UC-030"
    });
    expect(
      usecaseExportRequestSchema.parse({
        existing_file_content: "old output",
        force: true,
        output_path: "specs/UC-030.feature",
        revision_id: "revision-1"
      })
    ).toEqual({
      existing_file_content: "old output",
      force: true,
      output_path: "specs/UC-030.feature",
      revision_id: "revision-1"
    });
    expect(usecaseExportRequestSchema.parse({})).toEqual({ force: false });
  });

  test("rejects malformed shared export request boundaries", () => {
    expect(() => usecaseExportParamsSchema.parse({ id: "" })).toThrow();
    expect(() => usecaseExportRequestSchema.parse({ force: "yes" })).toThrow();
  });

  test("parses text export responses", () => {
    expect(gherkinExportResponseSchema.parse("Feature: Checkout")).toContain(
      "Feature:"
    );
    expect(markdownExportResponseSchema.parse("# UC-031")).toContain("#");
  });
});
