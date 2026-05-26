import assert from "node:assert/strict";
import { describe, test } from "vitest";
import { inferProjectKey, isValidProjectKey } from "../../lib/project-key";

describe("project key helpers", () => {
  test("infers a stable uppercase key from project names", () => {
    assert.equal(inferProjectKey("Payments Squad"), "PAYMENTS");
    assert.equal(inferProjectKey("2026 checkout ops"), "CHECKOUT");
    assert.equal(inferProjectKey("AI"), "AI");
    assert.equal(inferProjectKey("a"), "");
  });

  test("accepts only 2-8 character keys that start with a letter", () => {
    assert.equal(isValidProjectKey("PAY"), true);
    assert.equal(isValidProjectKey("OPS2026"), true);
    assert.equal(isValidProjectKey("A"), false);
    assert.equal(isValidProjectKey("2026OPS"), false);
    assert.equal(isValidProjectKey("TOO-LONG"), false);
    assert.equal(isValidProjectKey("lower"), false);
  });
});
