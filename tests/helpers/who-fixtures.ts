import type { TestServer } from "./server.js";
import type { ProjectSetup } from "./uc-fixtures.js";

export type WhoResponse = {
  archived?: boolean;
  locks: Array<{
    expires_at: string;
    held_by_session_id: null | string;
    held_by_user_id: string;
    id: string;
    lock_type: string;
  }>;
  merge_requests: Array<{
    conflict_count: number;
    id: string;
    source_branch_id: string;
    status: string;
  }>;
  sessions: Array<{
    agent_type: string;
    id: string;
    intent: string;
    markers?: string[];
    started_at: string;
    user_id: string;
  }>;
  suggested_next_actions: Array<{ command: string; reason: string }>;
  usecase: { id: string; key: string };
};

export type WhoProblem = {
  key_format?: string;
  locks?: unknown;
  merge_requests?: unknown;
  sessions?: unknown;
  suggested_next_actions: Array<{ command: string; reason: string }>;
  title: string;
};

export function whoUseCase(server: TestServer, setup: ProjectSetup, usecaseId: string) {
  return server.fetch(`/v1/usecases/${usecaseId}/who`, {
    headers: { Cookie: setup.cookie }
  });
}
