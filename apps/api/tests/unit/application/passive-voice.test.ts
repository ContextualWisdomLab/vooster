import { describe, expect, test } from "vitest";

import { usesPassiveVoice } from "../../../src/application/passive-voice.js";

describe("passive voice detector", () => {
  test("accepts product-recommended active step wording", () => {
    expect(
      usesPassiveVoice("validates the amount is positive and the category is selected")
    ).toBe(false);
  });

  test("does not apply the English passive-voice rule to Hangul actions", () => {
    expect(usesPassiveVoice("사용자가 금액을 입력하고 카테고리를 선택한다")).toBe(
      false
    );
  });

  test("still flags a passive English main predicate", () => {
    expect(usesPassiveVoice("Order is submitted.")).toBe(true);
  });
});
