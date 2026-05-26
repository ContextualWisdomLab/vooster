import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "../../../api/src/http/server.js";
import { createPrismaSignupStore } from "../../../api/src/infrastructure/prisma-signup-store.js";
import { withTestDatabase } from "../../../api/tests/helpers/postgres-db.js";

type RunCliOptions = {
  cwd?: string;
};

export function cleanupCliE2e() {
  return undefined;
}

// Commands that persist auth/project state (login, project create) write to the
// global config. config-store.ts refuses to touch ~/.vspec during tests, so any
// e2e test that triggers a write must point VSPEC_CONFIG_PATH at an isolated
// temp file. Returns one path so callers can share it across runCli calls in the
// same test (e.g. login then a follow-up that reads the session).
export function freshConfigPath(prefix = "vspec-cli-e2e-"): string {
  return join(mkdtempSync(join(tmpdir(), prefix)), "config.json");
}

export async function startNetworkServer(prefix: string) {
  void prefix;
  const database = await withTestDatabase();
  const app = await createServer({
    authStub: true,
    signupStore: createPrismaSignupStore(database.databaseUrl)
  });
  await app.listen({ host: "127.0.0.1", port: 0 });

  const address = app.server.address();
  if (address === null || typeof address === "string") {
    throw new Error("Expected Fastify to listen on a TCP port.");
  }

  return {
    apiUrl: `http://127.0.0.1:${String(address.port)}`,
    stop: async () => {
      try {
        await app.close();
      } finally {
        await database.teardown();
      }
    }
  };
}

export async function runCli(
  args: string[],
  env: Record<string, string> = {},
  options: RunCliOptions = {}
) {
  const repoRoot = process.cwd();
  const child = spawn(
    process.execPath,
    [join(repoRoot, "apps/cli/bin/run.js"), ...args],
    {
      cwd: options.cwd ?? repoRoot,
      env: { ...process.env, ...env, VSPEC_CLI_SOURCE: "1" }
    }
  );
  let stdout = "";
  let stderr = "";

  child.stdout.on("data", (chunk: Buffer) => {
    stdout += chunk.toString("utf8");
  });
  child.stderr.on("data", (chunk: Buffer) => {
    stderr += chunk.toString("utf8");
  });

  const status = await new Promise<number | null>((resolve, reject) => {
    child.on("error", reject);
    child.on("exit", resolve);
  });

  return { status, stderr, stdout };
}
