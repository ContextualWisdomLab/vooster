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

  test("documents default append behavior for step add", () => {
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
      "`vspec step add` appends by default when `--at` is omitted"
    );
    expect(
      json.sections.find((section) => section.heading === "Existing use case edits")
        ?.body
    ).toContain("`vspec step add` appends by default when `--at` is omitted");
  });

  test("refreshes markdown cache metadata when the CLI version changes", () => {
    const response = buildAiGuide({
      cachedGuides: [{ cli_version: "0.9.0", content: "old guide" }],
      cliVersion: "1.0.0",
      format: "markdown",
      simulateNetworkFailure: false
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      cache: {
        cli_version: "1.0.0",
        previous_cli_version: "0.9.0",
        status: "REFRESHED_VERSION_MISMATCH"
      }
    });
  });

  test("returns a cold offline problem without cached guide content", () => {
    const response = buildAiGuide({
      cachedGuides: [],
      cliVersion: "1.0.0",
      format: "markdown",
      simulateNetworkFailure: true
    });

    expect(response.status).toBe(503);
    expect(response.body).toMatchObject({
      bootstrap:
        "Read https://vspec.dev/ai-guide and retry vspec ai-guide once online.",
      exit_code: 5,
      status: 503,
      suggested_next_actions: [
        { command: "vspec ai-guide", reason: "Retry once network access returns." }
      ],
      title: "AI guide unavailable",
      type: "about:blank"
    });
  });

  test("falls back to a stale cached guide during network failure", () => {
    const response = buildAiGuide({
      cachedGuides: [{ cli_version: "0.9.0", content: "cached markdown" }],
      cliVersion: "1.0.0",
      format: "markdown",
      simulateNetworkFailure: true
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      cache: { cli_version: "0.9.0", status: "STALE_FALLBACK" },
      content:
        "WARNING: this guide may be out of date relative to the installed CLI.\n\ncached markdown",
      warnings: [
        {
          message:
            "Using cached guide 0.9.0 because the current guide could not be fetched.",
          type: "STALE_AI_GUIDE"
        }
      ]
    });
  });
});
