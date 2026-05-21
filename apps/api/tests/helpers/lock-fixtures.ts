import type { TestServer } from "./server.js";
import type { ProjectSetup } from "./uc-fixtures.js";

export type LockCreateResponse = {
  lock: {
    acquired_at: string;
    auto_release: boolean;
    expires_at: string;
    held_by_session_id: null | string;
    held_by_user_id: string;
    id: string;
    lock_type: string;
    reason: string;
    target_id: string;
    target_type: string;
  };
  suggested_next_actions: Array<{ command: string; reason: string }>;
};

export type LockProblemResponse = {
  expires_at?: string;
  held_by_user_id?: string;
  holding_session?: string;
  lock_id?: string;
  suggested_next_actions: Array<{ command: string; reason: string }>;
  title: string;
};

export function lockUseCase(
  server: TestServer,
  setup: ProjectSetup,
  targetId: string,
  body: { lock_type: "HARD" | "SEMANTIC" | "SOFT"; reason: string; ttl_minutes?: number },
  sessionId = "session-main-lock"
) {
  return server.fetch("/v1/locks", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: setup.cookie,
      "X-Vspec-Session": sessionId
    },
    body: JSON.stringify({
      ...body,
      target_id: targetId,
      target_type: "USECASE"
    })
  });
}

export function renewLock(
  server: TestServer,
  setup: ProjectSetup,
  lockId: string,
  body: { ttl_minutes?: number },
  sessionId = "session-main-lock"
) {
  return server.fetch(`/v1/locks/${lockId}/renew`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: setup.cookie,
      "X-Vspec-Session": sessionId
    },
    body: JSON.stringify(body)
  });
}
