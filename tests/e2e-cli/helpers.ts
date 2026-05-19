import { execFileSync, spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "../../src/http/server.js";
import { createPrismaSignupStore } from "../../src/infrastructure/prisma-signup-store.js";

const tempDirs: string[] = [];

export function cleanupCliE2e() {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir !== undefined) {
      rmSync(dir, { force: true, recursive: true });
    }
  }
}

export async function startNetworkServer(prefix: string) {
  const dir = mkdtempSync(join(tmpdir(), prefix));
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

export async function runCli(args: string[]) {
  const child = spawn(process.execPath, ["bin/run.js", ...args], {
    cwd: process.cwd(),
    env: { ...process.env, VSPEC_CLI_SOURCE: "1" }
  });
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
