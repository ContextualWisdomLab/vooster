import { describe, expect, test } from "vitest";

import { createPrismaApiKeyStore } from "../../src/infrastructure/prisma-api-key-store.js";
import { createPrismaCommentStore } from "../../src/infrastructure/prisma-comment-store.js";
import { createPrismaUserStore } from "../../src/infrastructure/prisma-user-store.js";

describe("Prisma adapter split", () => {
  test("comment store has a dedicated Prisma adapter", () => {
    expect(createPrismaCommentStore).toBeTypeOf("function");
  });

  test("api key store has a dedicated Prisma adapter", () => {
    expect(createPrismaApiKeyStore).toBeTypeOf("function");
  });

  test("user store has a dedicated Prisma adapter", () => {
    expect(createPrismaUserStore).toBeTypeOf("function");
  });
});
