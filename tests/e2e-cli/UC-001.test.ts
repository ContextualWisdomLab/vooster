import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { createServer } from "../../src/http/server.js";
import { createPrismaSignupStore } from "../../src/infrastructure/prisma-signup-store.js";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir !== undefined) {
      rmSync(dir, { force: true, recursive: true });
    }
  }
});

describe("UC-001 CLI - Sign up for a workspace", () => {
  test("MAIN: login creates a workspace and prints the next command", async () => {
    const server = await startNetworkServer();
    try {
      const result = spawnSync(
        process.execPath,
        [
          "bin/run.js",
          "login",
          "--workspace-name",
          "CLI Workspace",
          "--workspace-slug",
          "cli-workspace",
          "--github-code",
          "stub-cli-user",
          "--api-url",
          server.apiUrl
        ],
        {
          cwd: process.cwd(),
          encoding: "utf8"
        }
      );

      expect(result.stderr).toBe("");
      expect(result.status).toBe(0);
      expect(result.stdout).toContain("cli-workspace");
      expect(result.stdout).toContain("stub-cli-user@users.noreply.github.com");
      expect(result.stdout).toContain("vspec project create");
    } finally {
      await server.stop();
    }
  });
});

async function startNetworkServer() {
  const dir = mkdtempSync(join(tmpdir(), "vspec-cli-uc001-"));
  tempDirs.push(dir);
  const databaseUrl = `file:${join(dir, "test.sqlite")}`;
  execFileSync("npx", ["prisma", "db", "push", "--skip-generate"], {
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: "ignore"
  });

  const app = await createServer({
    authStub: true,
    signupStore: createPrismaSignupStore(databaseUrl)
  });
  await app.listen({ host: "127.0.0.1", port: 0 });

  const address = app.server.address();
  if (address === null || typeof address === "string") {
    throw new Error("Expected Fastify to listen on a TCP port.");
  }

  return {
    apiUrl: `http://127.0.0.1:${String(address.port)}`,
    stop: async () => {
      await app.close();
    }
  };
}
