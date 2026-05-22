import type { PrismaClient } from "@prisma/client";

import type { StoredWorkSession } from "../domain/entities/index.js";
import type { WorkSessionStore } from "../ports/work-session-store.js";
import {
  storedWorkSession,
  workSessionData,
  workSessionUpdate
} from "./prisma-signup-mappers.js";

export function createPrismaWorkSessionStore(prisma: PrismaClient): WorkSessionStore {
  return new PrismaWorkSessionStore(prisma);
}

class PrismaWorkSessionStore implements WorkSessionStore {
  constructor(private readonly prisma: PrismaClient) {}

  async findWorkSessionById(sessionId: string): Promise<StoredWorkSession | undefined> {
    const session = await this.prisma.workSession.findUnique({
      where: { id: sessionId }
    });

    return session === null ? undefined : storedWorkSession(session);
  }

  async listWorkSessions(): Promise<StoredWorkSession[]> {
    const sessions = await this.prisma.workSession.findMany({
      orderBy: { started_at: "desc" }
    });

    return sessions.map(storedWorkSession);
  }

  async listWorkSessionsForUseCase(usecaseId: string): Promise<StoredWorkSession[]> {
    return (await this.listWorkSessions()).filter(
      (session) =>
        session.usecase_id === usecaseId ||
        session.pinned_revisions?.[usecaseId] !== undefined
    );
  }

  async saveWorkSession(session: StoredWorkSession): Promise<void> {
    await this.prisma.workSession.create({ data: workSessionData(session) });
  }

  async updateWorkSession(session: StoredWorkSession): Promise<void> {
    await this.prisma.workSession.update({
      data: workSessionUpdate(session),
      where: { id: session.id }
    });
  }
}
