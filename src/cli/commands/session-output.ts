export type SessionStartResponse = {
  session: {
    agent_identifier: string;
    agent_type: string;
    id: string;
    intent: string;
    pinned_revisions: Record<string, string>;
  };
  session_file: {
    path: string;
  };
  suggested_next_actions: Array<{
    command: string;
  }>;
};

export type SessionListResponse = {
  sessions: Array<{
    agent_identifier: string;
    agent_type: string;
    branch_name: null | string;
    conflict_markers: string[];
    id: string;
    idle_seconds: number;
    intent: string;
    lock_count: number;
    markers: string[];
    pinned_keys: string[];
    status: string;
  }>;
  suggested_next_actions?: Array<{
    command: string;
  }>;
  summary: {
    total_conflicts: number;
  };
  total: number;
};

export type SessionCompleteResponse = {
  merge_request?: {
    conflicts: unknown[];
    id: string;
    status: string;
    strategy: string;
  };
  released_lock_ids: string[];
  session: {
    ended_at: string;
    id: string;
    status: string;
  };
  session_file: {
    path: string;
  };
  suggested_next_actions: Array<{
    command: string;
  }>;
  warnings?: Array<{
    lock_id: string;
    type: string;
  }>;
};

export function printSessionStart(
  body: SessionStartResponse,
  writeLine: (message: string) => void
): void {
  writeLine(`Session ${body.session.id}`);
  writeLine(`Intent ${body.session.intent}`);
  writeLine(`Agent ${body.session.agent_type} ${body.session.agent_identifier}`);
  writeLine(`Pinned revisions ${String(Object.keys(body.session.pinned_revisions).length)}`);
  writeLine(`Session file ${body.session_file.path}`);
  for (const action of body.suggested_next_actions) {
    writeLine(action.command);
  }
}

export function printSessionList(
  body: SessionListResponse,
  writeLine: (message: string) => void
): void {
  writeLine(`Total sessions ${String(body.total)}`);
  writeLine(`Total conflicts ${String(body.summary.total_conflicts)}`);
  for (const session of body.sessions) {
    writeLine(`Session ${session.id}`);
    writeLine(`Status ${session.status}`);
    writeLine(`Agent ${session.agent_type} ${session.agent_identifier}`);
    writeLine(`Intent ${session.intent}`);
    writeLine(`Pins ${session.pinned_keys.join(", ") || "none"}`);
    writeLine(`Branch ${session.branch_name ?? "none"}`);
    writeLine(`Idle seconds ${String(session.idle_seconds)}`);
    writeLine(`Locks ${String(session.lock_count)}`);
    writeLine(`Conflicts ${String(session.conflict_markers.length)}`);
    if (session.markers.length > 0) {
      writeLine(`Markers ${session.markers.join(", ")}`);
    }
  }
  for (const action of body.suggested_next_actions ?? []) {
    writeLine(action.command);
  }
}

export function printSessionComplete(
  body: SessionCompleteResponse,
  writeLine: (message: string) => void
): void {
  writeLine(`Session ${body.session.id}`);
  writeLine(`Status ${body.session.status}`);
  writeLine(`Ended at ${body.session.ended_at}`);
  writeLine(`Released locks ${body.released_lock_ids.join(", ") || "none"}`);
  if (body.merge_request !== undefined) {
    writeLine(`Merge request ${body.merge_request.id}`);
    writeLine(`Merge status ${body.merge_request.status}`);
    writeLine(`Strategy ${body.merge_request.strategy}`);
    writeLine(`Conflicts ${String(body.merge_request.conflicts.length)}`);
  }
  writeLine(`Session file ${body.session_file.path} cleared`);
  for (const warning of body.warnings ?? []) {
    writeLine(`Warning ${warning.type} ${warning.lock_id}`);
  }
  for (const action of body.suggested_next_actions) {
    writeLine(action.command);
  }
}
