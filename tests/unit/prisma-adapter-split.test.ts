import { describe, expect, test } from "vitest";

import { createPrismaActorStore } from "../../src/infrastructure/prisma-actor-store.js";
import { createPrismaApiKeyStore } from "../../src/infrastructure/prisma-api-key-store.js";
import { createPrismaBranchStore } from "../../src/infrastructure/prisma-branch-store.js";
import { createPrismaCommentStore } from "../../src/infrastructure/prisma-comment-store.js";
import { createPrismaLockStore } from "../../src/infrastructure/prisma-lock-store.js";
import { createPrismaMembershipStore } from "../../src/infrastructure/prisma-membership-store.js";
import { createPrismaProjectStore } from "../../src/infrastructure/prisma-project-store.js";
import { createPrismaStakeholderStore } from "../../src/infrastructure/prisma-stakeholder-store.js";
import { createPrismaUserStore } from "../../src/infrastructure/prisma-user-store.js";
import { createPrismaWorkspaceStore } from "../../src/infrastructure/prisma-workspace-store.js";

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

  test("workspace store has a dedicated Prisma adapter", () => {
    expect(createPrismaWorkspaceStore).toBeTypeOf("function");
  });

  test("membership store has a dedicated Prisma adapter", () => {
    expect(createPrismaMembershipStore).toBeTypeOf("function");
  });

  test("project store has a dedicated Prisma adapter", () => {
    expect(createPrismaProjectStore).toBeTypeOf("function");
  });

  test("lock store has a dedicated Prisma adapter", () => {
    expect(createPrismaLockStore).toBeTypeOf("function");
  });

  test("branch store has a dedicated Prisma adapter", () => {
    expect(createPrismaBranchStore).toBeTypeOf("function");
  });

  test("actor store has a dedicated Prisma adapter", () => {
    expect(createPrismaActorStore).toBeTypeOf("function");
  });

  test("stakeholder store has a dedicated Prisma adapter", () => {
    expect(createPrismaStakeholderStore).toBeTypeOf("function");
  });
});
