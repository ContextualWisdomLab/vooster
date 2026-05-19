import type { StoredWorkSession } from "../http/signup-types.js";

export type WorkSessionStore = {
  findWorkSessionById: (sessionId: string) => Promise<StoredWorkSession | undefined>;
  listWorkSessions: () => Promise<StoredWorkSession[]>;
  listWorkSessionsForUseCase: (usecaseId: string) => Promise<StoredWorkSession[]>;
  saveWorkSession: (session: StoredWorkSession) => Promise<void>;
  updateWorkSession: (session: StoredWorkSession) => Promise<void>;
};
