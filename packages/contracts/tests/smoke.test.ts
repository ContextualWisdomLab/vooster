import { describe, expect, test } from "vitest";
import { healthResponseSchema, type HealthResponse } from "../src/index.js";

describe("shared API contracts", () => {
  test("parse runtime payloads and expose inferred types", () => {
    const parsed: HealthResponse = healthResponseSchema.parse({ status: "ok" });

    expect(parsed.status).toBe("ok");
    expect(() => healthResponseSchema.parse({ status: "bad" })).toThrow();
  });
});
