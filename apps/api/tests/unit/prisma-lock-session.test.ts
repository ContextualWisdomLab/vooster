import type { PrismaClient } from "@prisma/client";
import { describe, expect, test, vi } from "vitest";
import type { StoredLock } from "../../src/domain/entities/index.js";
import { ensureLockSession } from "../../src/infrastructure/prisma-lock-session.js";

describe("prisma lock session helper", () => {
  test("skips locks that are not held by a session", async () => {
    for (const held_by_session_id of [null, undefined]) {
      const prisma = prismaClient({ projectId: "project-1" });

      await ensureLockSession(prisma.client, lock({ held_by_session_id }));

      expect(prisma.findUnique).not.toHaveBeenCalled();
      expect(prisma.upsert).not.toHaveBeenCalled();
    }
  });

  test("skips upserts when the target use case is missing", async () => {
    const prisma = prismaClient({ projectId: null });

    await ensureLockSession(prisma.client, lock({ held_by_session_id: "session-1" }));

    expect(prisma.findUnique).toHaveBeenCalledWith({
      select: { project_id: true },
      where: { id: "usecase-1" }
    });
    expect(prisma.upsert).not.toHaveBeenCalled();
  });

  test("upserts a session for locks held by a session", async () => {
    const prisma = prismaClient({ projectId: "project-1" });

    await ensureLockSession(
      prisma.client,
      lock({ held_by_session_id: "session-1", target_id: "target-usecase" })
    );

    expect(prisma.findUnique).toHaveBeenCalledWith({
      select: { project_id: true },
      where: { id: "target-usecase" }
    });
    expect(prisma.upsert).toHaveBeenCalledWith({
      create: {
        id: "session-1",
        intent: "Hold use case lock",
        project_id: "project-1",
        user_id: "user-1"
      },
      update: {},
      where: { id: "session-1" }
    });
  });

  test("uses the lock holder when no held-by user is recorded", async () => {
    const prisma = prismaClient({ projectId: "project-1" });

    await ensureLockSession(
      prisma.client,
      lock({ held_by_session_id: "session-1", held_by_user_id: undefined })
    );

    const upsertArgs = prisma.upsert.mock.calls.at(0)?.[0];
    expect(upsertArgs?.create.user_id).toBe("session-holder");
  });
});

type UseCaseFindUniqueArgs = {
  select: { project_id: true };
  where: { id: string };
};

type WorkSessionUpsertArgs = {
  create: {
    id: string;
    intent: string;
    project_id: string;
    user_id: string;
  };
  update: Record<string, never>;
  where: { id: string };
};

function prismaClient(options: { projectId: null | string }) {
  const findUnique = vi.fn(
    (args: UseCaseFindUniqueArgs): Promise<null | { project_id: string }> => {
      void args;
      return Promise.resolve(
        options.projectId === null ? null : { project_id: options.projectId }
      );
    }
  );
  const upsert = vi.fn(
    (args: WorkSessionUpsertArgs): Promise<WorkSessionUpsertArgs> =>
      Promise.resolve(args)
  );
  return {
    client: {
      useCase: { findUnique },
      workSession: { upsert }
    } as unknown as PrismaClient,
    findUnique,
    upsert
  };
}

function lock(overrides: Partial<StoredLock> = {}): StoredLock {
  return {
    expires_at: "2026-05-23T11:00:00Z",
    held_by_session_id: "session-1",
    held_by_user_id: "user-1",
    holder: "session-holder",
    id: "lock-1",
    mode: "HARD",
    reason: "Editing checkout",
    usecase_id: "usecase-1",
    ...overrides
  };
}
