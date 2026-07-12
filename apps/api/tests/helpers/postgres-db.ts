import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createConnection } from "node:net";
import path from "node:path";
import { promisify } from "node:util";

import { PrismaClient } from "@prisma/client";

const execFileAsync = promisify(execFile);
const root = path.resolve(import.meta.dirname, "../../../..");
const defaultTestDatabaseUrl = "postgresql://vspec:vspec@127.0.0.1:5433/vspec_test";

export type TestDatabase = {
  databaseUrl: string;
  schema: string;
  teardown: () => Promise<void>;
};

export async function withTestDatabase(): Promise<TestDatabase> {
  const schema = `test_${randomUUID().replaceAll("-", "_")}`;
  const databaseUrl = databaseUrlForSchema(schema);
  await assertPostgresReachable(new URL(databaseUrl));
  const pnpm = pnpmCommand([
    "exec",
    "prisma",
    "db",
    "push",
    "--schema",
    "apps/api/prisma/schema.prisma",
    "--skip-generate"
  ]);

  // Keep this command aligned with the goal gate's relocated Prisma schema.
  await execFileAsync(pnpm.command, pnpm.args, {
    cwd: root,
    env: { ...process.env, DATABASE_URL: databaseUrl },
    maxBuffer: 10 * 1024 * 1024
  });

  return {
    databaseUrl,
    schema,
    teardown: async () => {
      await dropSchema(schema);
    }
  };
}

function pnpmCommand(args: string[]): { command: string; args: string[] } {
  const npmExecPath = process.env.npm_execpath;
  if (npmExecPath !== undefined && path.basename(npmExecPath).includes("pnpm")) {
    return { command: process.execPath, args: [npmExecPath, ...args] };
  }
  if (process.platform === "win32") {
    return { command: "cmd.exe", args: ["/d", "/s", "/c", "pnpm", ...args] };
  }
  return { command: "pnpm", args };
}

async function assertPostgresReachable(url: URL): Promise<void> {
  const port = Number(url.port || "5432");
  await new Promise<void>((resolve, reject) => {
    const socket = createConnection({ host: url.hostname, port });
    const fail = (message: string) => {
      socket.destroy();
      reject(
        new Error(
          `Postgres test database is unreachable at ${url.hostname}:${String(port)}. ${message} Set TEST_DATABASE_URL or start the local test database before running persistence tests.`
        )
      );
    };

    socket.setTimeout(1500);
    socket.once("connect", () => {
      socket.destroy();
      resolve();
    });
    socket.once("timeout", () => {
      fail("Connection timed out.");
    });
    socket.once("error", (error: NodeJS.ErrnoException) => {
      fail(error.code !== undefined ? error.code : error.message);
    });
  });
}

function databaseUrlForSchema(schema: string): string {
  const url = baseDatabaseUrl();
  url.searchParams.set("schema", schema);
  return url.toString();
}

function baseDatabaseUrl(): URL {
  const url = new URL(process.env.TEST_DATABASE_URL ?? defaultTestDatabaseUrl);

  if (url.protocol !== "postgresql:" && url.protocol !== "postgres:") {
    throw new Error("TEST_DATABASE_URL must be a PostgreSQL connection URL.");
  }

  url.protocol = "postgresql:";
  url.searchParams.delete("schema");
  return url;
}

async function dropSchema(schema: string): Promise<void> {
  const admin = new PrismaClient({
    datasources: { db: { url: databaseUrlForSchema("public") } }
  });

  try {
    await admin.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  } finally {
    await admin.$disconnect();
  }
}
