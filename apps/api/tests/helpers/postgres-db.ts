import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
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

  // Keep this command aligned with the goal gate's relocated Prisma schema.
  await execFileAsync(
    "pnpm",
    [
      "exec",
      "prisma",
      "db",
      "push",
      "--schema",
      "apps/api/prisma/schema.prisma",
      "--skip-generate"
    ],
    {
      cwd: root,
      env: { ...process.env, DATABASE_URL: databaseUrl },
      maxBuffer: 10 * 1024 * 1024
    }
  );

  return {
    databaseUrl,
    schema,
    teardown: async () => {
      await dropSchema(schema);
    }
  };
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
