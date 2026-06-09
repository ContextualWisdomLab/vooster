import { describe, expect, test } from "vitest";

import { buildAiGuide } from "../../../src/application/ai-guide.js";

describe("AI guide", () => {
  test("teaches stakeholder interests before scenario authoring", () => {
    const markdown = buildAiGuide({
      cachedGuides: [],
      cliVersion: "1.0.0",
      format: "markdown",
      simulateNetworkFailure: false
    }).body as { content: string };
    const json = buildAiGuide({
      cachedGuides: [],
      cliVersion: "1.0.0",
      format: "json",
      simulateNetworkFailure: false
    }).body as { sections: Array<{ body: string; heading: string }> };

    expect(markdown.content).toContain(
      "Add at least one stakeholder interest before creating scenarios."
    );
    expect(
      json.sections.find((section) => section.heading === "Greenfield setup")?.body
    ).toContain("Add at least one stakeholder interest before creating scenarios.");
  });
});
