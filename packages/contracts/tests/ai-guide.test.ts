import { describe, expect, test } from "vitest";
import {
  aiGuideJsonResponseSchema,
  aiGuideMarkdownResponseSchema,
  aiGuideQuerySchema,
  aiGuideRequestBodySchema
} from "../src/index.js";

describe("AI guide contracts", () => {
  test("default request query and body fields match the public route", () => {
    expect(aiGuideQuerySchema.parse({})).toEqual({
      cli_version: "1.0.0",
      format: "markdown"
    });
    expect(aiGuideRequestBodySchema.parse({})).toEqual({
      cached_guides: [],
      simulate_network_failure: false
    });
  });

  test("parse markdown and json success responses", () => {
    expect(
      aiGuideMarkdownResponseSchema.parse({
        cache: { cli_version: "1.0.0", status: "REFRESHED" },
        content: "# Guide",
        suggested_next_actions: [{ command: "vspec login", reason: "Authenticate." }]
      }).content
    ).toBe("# Guide");

    expect(
      aiGuideJsonResponseSchema.parse({
        examples: [{ commands: ["vspec login"], title: "First pinned edit" }],
        sections: [{ body: "Use sessions.", heading: "Why sessions exist" }],
        suggested_next_actions: [{ command: "vspec login", reason: "Authenticate." }],
        version: "1.0.0"
      }).version
    ).toBe("1.0.0");
  });
});
