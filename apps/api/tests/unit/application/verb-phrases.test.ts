import { describe, expect, test } from "vitest";
import { titleLooksLikeVerbPhrase } from "../../../src/application/verb-phrases.js";

describe("verb phrase heuristic", () => {
  test.each(["Pin a use case", "Pins a use case", "Diagnoses project drift"])(
    "accepts '%s'",
    (title) => {
      expect(titleLooksLikeVerbPhrase(title)).toBe(true);
    }
  );

  test("rejects titles without a recognized starting verb", () => {
    expect(titleLooksLikeVerbPhrase("Order status")).toBe(false);
  });
});
