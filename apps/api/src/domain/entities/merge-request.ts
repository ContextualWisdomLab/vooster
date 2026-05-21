export type StoredMergeRequest = {
  conflicts: Array<Record<string, unknown>>;
  created_by?: string;
  current_revision_id?: string;
  id: string;
  impact: {
    affected_branches: string[];
    affected_sessions: string[];
    severity_by_entity: Record<string, string>;
  };
  source_branch_id: null | string;
  status: "CLOSED" | "MERGED" | "OPEN";
  strategy: "FAST_FORWARD" | "SQUASH";
  target_branch_id: string;
  resolved_at?: string;
};
