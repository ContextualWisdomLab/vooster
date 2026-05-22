import type { PrismaClient } from "@prisma/client";
import type { StoredLock } from "../domain/entities/index.js";

export async function ensureLockSession(
  prisma: PrismaClient,
  lock: StoredLock
): Promise<void> {
  if (lock.held_by_session_id === null || lock.held_by_session_id === undefined) {
    return;
  }
  const usecase = await prisma.useCase.findUnique({
    select: { project_id: true },
    where: { id: lock.target_id ?? lock.usecase_id }
  });
  if (usecase === null) {
    return;
  }
  await prisma.workSession.upsert({
    create: {
      id: lock.held_by_session_id,
      intent: "Hold use case lock",
      project_id: usecase.project_id,
      user_id: lock.held_by_user_id ?? lock.holder
    },
    update: {},
    where: { id: lock.held_by_session_id }
  });
}
