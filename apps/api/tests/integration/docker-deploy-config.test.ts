import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, test } from "vitest";

const root = path.resolve(import.meta.dirname, "../../../..");

describe("Goal 2 Docker deploy configuration", () => {
  test("Dockerfile and production compose describe the deploy stack", async () => {
    const dockerfile = await readFile(path.join(root, "Dockerfile"), "utf8");
    const compose = await readFile(path.join(root, "docker-compose.prod.yml"), "utf8");

    expect(dockerfile).toContain("FROM node:20-alpine AS deps");
    expect(dockerfile).toContain("FROM node:20-alpine AS build");
    expect(dockerfile).toContain("FROM node:20-alpine AS runtime");
    expect(dockerfile).toContain("EXPOSE 8080");
    expect(dockerfile).toContain("prisma db push --schema apps/api/prisma/schema.prisma --skip-generate");
    expect(dockerfile).toContain("dist/apps/api/src/index.js");

    expect(compose).toContain("app:");
    expect(compose).toContain("db:");
    expect(compose).toContain("DATABASE_URL");
    expect(compose).toContain("${DATABASE_URL:-");
    expect(compose).toContain("${VSPEC_DEPLOY_HOST_PORT:-4400}:8080");
    expect(compose).toContain("postgres:16-alpine");
  });
});
