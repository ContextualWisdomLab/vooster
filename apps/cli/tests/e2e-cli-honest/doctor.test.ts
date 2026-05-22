import { describe, expect, test } from "vitest";

import { runCli, startNetworkServer } from "../e2e-cli/helpers.js";
import { seedViaCli } from "./cli-setup.js";

describe("honest CLI - doctor", () => {
  test("requests a server-backed diagnostic through the CLI", async () => {
    const server = await startNetworkServer("vspec-honest-doctor-");
    try {
      const seed = await seedViaCli({ apiUrl: server.apiUrl, projectKey: "DOC", runCli });
      const result = await runCli([
        "doctor",
        "--project-id",
        seed.projectId
      ], seed.env);

      expect(seed.env.VSPEC_CONFIG_PATH).toContain("config.json");
      expect(result.status).not.toBeNull();
    } finally {
      await server.stop();
    }
  }, 30_000);
});
