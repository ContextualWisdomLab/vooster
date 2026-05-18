import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { startServer, type TestServer } from "../helpers/server.js";

type GuideResponse = {
  cache: { cli_version: string; status: string };
  content: string;
  suggested_next_actions: Array<{ command: string; reason: string }>;
};
type JsonGuideResponse = {
  examples: Array<{ commands: string[]; title: string }>;
  sections: Array<{ heading: string; body: string }>;
  suggested_next_actions: Array<{ command: string; reason: string }>;
  version: string;
};

let server: TestServer;
beforeAll(async () => { server = await startServer(); });
afterAll(async () => { await server.stop(); });

describe("UC-033 - Learn how to use vspec (AI agent)", () => {
  test("MAIN: public markdown guide bootstraps a fresh AI agent", async () => {
    const response = await server.fetch("/v1/ai-guide?cli_version=1.0.0", {
      method: "POST"
    });

    expect(response.status).toBe(200);
    const guide = (await response.json()) as GuideResponse;
    expect(guide.cache).toEqual({ cli_version: "1.0.0", status: "REFRESHED" });
    expect(guide.content).toContain("# vspec AI Agent Guide");
    expect(guide.content).toContain("Why sessions exist");
    expect(guide.content).toContain("pin -> fetch via --format=agent -> propose-change -> commit");
    expect(guide.content).toContain("The --format=agent payload contract");
    expect(guide.content).toContain("Forbidden actions");
    expect(guide.content).toContain("Worked example");
    expect(guide.suggested_next_actions).toEqual([
      { command: "vspec login", reason: "Authenticate before working with private specs." },
      { command: "vspec project list", reason: "Find the project to inspect." },
      { command: "vspec session start", reason: "Pin the target use cases before editing." }
    ]);
  });

  test("1a: JSON format returns structured guide content", async () => {
    const response = await server.fetch("/v1/ai-guide?cli_version=1.0.0&format=json", {
      method: "POST"
    });

    expect(response.status).toBe(200);
    const guide = (await response.json()) as JsonGuideResponse;
    expect(guide.version).toBe("1.0.0");
    expect(guide.sections.map((section) => section.heading)).toEqual([
      "Why sessions exist",
      "Mandatory workflow",
      "The --format=agent payload contract",
      "Forbidden actions"
    ]);
    expect(guide.examples).toContainEqual({
      title: "First safe task",
      commands: ["vspec login", "vspec project list", "vspec session start"]
    });
    expect(guide.suggested_next_actions[0]).toEqual({
      command: "vspec login",
      reason: "Authenticate before working with private specs."
    });
  });
});
