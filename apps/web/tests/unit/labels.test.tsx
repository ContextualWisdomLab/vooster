import assert from "node:assert/strict";
import { describe, test } from "vitest";
import { GLOSSARY, levelLabel, statusLabel } from "../../lib/labels";

describe("level labels", () => {
  test("maps every spec level enum value to a Korean label", () => {
    assert.equal(levelLabel("SUMMARY"), "요약");
    assert.equal(levelLabel("USER_GOAL"), "사용자 목표");
    assert.equal(levelLabel("SUBFUNCTION"), "하위 기능");
  });

  test("is case-insensitive and falls back to the raw value", () => {
    assert.equal(levelLabel("user_goal"), "사용자 목표");
    assert.equal(levelLabel("MYSTERY"), "MYSTERY");
  });
});

describe("status labels", () => {
  test("maps every spec status enum value to a Korean label", () => {
    assert.equal(statusLabel("DRAFT"), "초안");
    assert.equal(statusLabel("IN_REVIEW"), "검토 중");
    assert.equal(statusLabel("APPROVED"), "확정");
    assert.equal(statusLabel("DEPRECATED"), "폐기");
  });

  test("is case-insensitive and falls back to the raw value", () => {
    assert.equal(statusLabel("approved"), "확정");
    assert.equal(statusLabel("UNKNOWN"), "UNKNOWN");
  });
});

describe("glossary", () => {
  test("describes every use-case term that needs a popover", () => {
    for (const key of [
      "primary_actor",
      "level",
      "main_scenario",
      "extensions",
      "stakeholder_interests"
    ] as const) {
      assert.ok(GLOSSARY[key].label.length > 0, `${key} missing label`);
      assert.ok(GLOSSARY[key].description.length > 0, `${key} missing description`);
    }
  });

  test("uses canonical labels, not snake_case field names", () => {
    assert.equal(GLOSSARY.primary_actor.label, "주요 액터");
    assert.equal(GLOSSARY.main_scenario.label, "메인 시나리오");
    assert.equal(GLOSSARY.usecase.label, "유스케이스");
  });
});
