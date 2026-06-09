import { describe, expect, test } from "vitest";
import { titleLooksLikeVerbPhrase } from "../../../src/application/verb-phrases.js";

describe("verb phrase heuristic", () => {
  test.each([
    "Pin a use case",
    "Pins a use case",
    "Diagnoses project drift",
    "Partner accepts a shared-budget invitation",
    "User exports their expenses to CSV",
    "User logs a new expense"
  ])("accepts '%s'", (title) => {
    expect(titleLooksLikeVerbPhrase(title)).toBe(true);
  });

  test.each(["주문을 생성한다", "결제를 승인한다", "세션을 시작한다"])(
    "accepts Korean verb phrase '%s'",
    (title) => {
      expect(titleLooksLikeVerbPhrase(title, { spec_language: "ko" })).toBe(true);
    }
  );

  test("rejects titles without a finite verb", () => {
    expect(titleLooksLikeVerbPhrase("Order status")).toBe(false);
    expect(titleLooksLikeVerbPhrase("Expense report")).toBe(false);
    expect(titleLooksLikeVerbPhrase("주문 상태", { spec_language: "ko" })).toBe(false);
  });
});
