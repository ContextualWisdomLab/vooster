import { describe, expect, test } from "vitest";

import {
  classifyError,
  ErrorCode,
  extractError
} from "../../src/domain/error-codes.js";

describe("error code classification", () => {
  test("prefers typed API error codes over status or problem titles", () => {
    expect(
      classifyError(400, {
        code: "SCHEMA_INVALID",
        title: "Any translated validation message"
      })
    ).toBe(ErrorCode.SCHEMA_INVALID);

    expect(
      classifyError(422, {
        code: "TITLE_NOT_VERB_PHRASE",
        title: "localized title copy"
      })
    ).toBe(ErrorCode.TITLE_NOT_VERB_PHRASE);
  });

  test("keeps self-teaching field details without duplicating the code", () => {
    expect(
      extractError(400, {
        allowed_values: ["P0", "P1", "P2", "P3"],
        code: "SCHEMA_INVALID",
        field: "priority",
        title: "Invalid use case request"
      })
    ).toEqual({
      code: ErrorCode.SCHEMA_INVALID,
      details: {
        allowed_values: ["P0", "P1", "P2", "P3"],
        field: "priority"
      },
      message: "Invalid use case request"
    });
  });
});
