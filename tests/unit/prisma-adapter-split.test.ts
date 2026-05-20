import { describe, expect, test } from "vitest";

import { createPrismaCommentStore } from "../../src/infrastructure/prisma-comment-store.js";

describe("Prisma adapter split", () => {
  test("comment store has a dedicated Prisma adapter", () => {
    expect(createPrismaCommentStore).toBeTypeOf("function");
  });
});
