import { PrismaClient } from "@prisma/client";
import { describe, expect, test } from "vitest";

import { withTestDatabase } from "../helpers/postgres-db.js";

describe("Postgres test database helper", () => {
  test("creates isolated schemas and tears them down", async () => {
    const first = await withTestDatabase();
    const second = await withTestDatabase();

    expect(first.databaseUrl).toContain("postgresql://");
    expect(second.databaseUrl).toContain("postgresql://");
    expect(first.databaseUrl).not.toBe(second.databaseUrl);
    expect(new URL(first.databaseUrl).searchParams.get("schema")).toMatch(/^test_/);
    expect(new URL(second.databaseUrl).searchParams.get("schema")).toMatch(/^test_/);

    const firstClient = new PrismaClient({
      datasources: { db: { url: first.databaseUrl } }
    });
    const secondClient = new PrismaClient({
      datasources: { db: { url: second.databaseUrl } }
    });

    try {
      await firstClient.user.create({
        data: {
          email: "helper-one@example.com",
          github_id: "helper-one"
        }
      });

      await expect(
        secondClient.user.findUnique({ where: { github_id: "helper-one" } })
      ).resolves.toBeNull();
    } finally {
      await firstClient.$disconnect();
      await secondClient.$disconnect();
      await first.teardown();
      await second.teardown();
    }
  }, 60_000);
});
