import type { TestServer } from "./server.js";

export type SessionStartResponse = {
  branch?: {
    base_branch_id: string;
    id: string;
    name: string;
    owner_id: string;
    owner_type: string;
    project_id: string;
  };
  session: {
    agent_identifier: string;
    agent_type: string;
    branch_id: null | string;
    id: string;
    intent: string;
    pinned_revisions: Record<string, string>;
    project_id: string;
    started_at: string;
    status: string;
    user_id: string;
  };
  session_file: {
    path: string;
    session_id: string;
  };
  suggested_next_actions: Array<{ command: string; reason: string }>;
  warnings?: Array<{ message: string; type: string }>;
};

export type SessionProblemResponse = {
  created_branch?: boolean;
  created_session?: boolean;
  conflicting_session?: string;
  holding_session?: string;
  offending_key?: string;
  session_count?: number;
  suggested_next_actions: Array<{ command: string; reason: string }>;
  title: string;
};

export type SessionCompleteResponse = {
  merge_request?: {
    conflicts: unknown[];
    id: string;
    impact: {
      affected_branches: string[];
      affected_sessions: string[];
      severity_by_entity: Record<string, string>;
    };
    source_branch_id: string;
    status: string;
    strategy: string;
    target_branch_id: string;
  };
  released_lock_ids: string[];
  session: { branch_id: string; ended_at: string; id: string; status: string };
  session_file: { cleared: boolean; path: string };
  suggested_next_actions: Array<{ command: string; reason: string }>;
  warnings?: Array<{ lock_id: string; message: string; type: string }>;
};

export type SessionCompleteProblem = {
  current_status?: string;
  suggested_next_actions: Array<{ command: string; reason: string }>;
  title: string;
};

export function startWorkSession(
  server: TestServer,
  setup: { cookie: string; projectId: string },
  body: {
    agent_type: string;
    auto_branch?: boolean;
    branch_name?: string;
    intent: string;
    pins: string[];
    simulate_write_failure?: boolean;
  },
  agent = "codex-cli"
) {
  return server.fetch("/v1/sessions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: setup.cookie,
      "X-Vspec-Agent": agent
    },
    body: JSON.stringify({
      ...body,
      project_id: setup.projectId
    })
  });
}

export function completeWorkSession(
  server: TestServer,
  sessionId: string,
  cookie: string,
  body: {
    no_merge?: boolean;
    simulate_conflicts?: boolean;
    simulate_completion_failure?: boolean;
    simulate_failed_lock_release?: string;
    summary?: string;
  }
) {
  return server.fetch(`/v1/sessions/${sessionId}/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify(body)
  });
}
