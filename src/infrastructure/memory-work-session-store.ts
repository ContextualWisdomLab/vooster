import type { StoredWorkSession } from "../http/signup-types.js";
import type { WorkSessionStore } from "../ports/work-session-store.js";

export function createMemoryWorkSessionStore(): WorkSessionStore {
  const sessionsById = new Map<string, StoredWorkSession>();

  return {
    findWorkSessionById(sessionId) {
      return Promise.resolve(sessionsById.get(sessionId));
    },

    listWorkSessions() {
      return Promise.resolve([...sessionsById.values()]);
    },

    listWorkSessionsForUseCase(usecaseId) {
      return Promise.resolve(
        [...sessionsById.values()].filter((session) =>
          session.usecase_id === usecaseId ||
          session.pinned_revisions?.[usecaseId] !== undefined
        )
      );
    },

    saveWorkSession(session) {
      sessionsById.set(session.id, session);
      return Promise.resolve();
    },

    updateWorkSession(session) {
      sessionsById.set(session.id, session);
      return Promise.resolve();
    }
  };
}
