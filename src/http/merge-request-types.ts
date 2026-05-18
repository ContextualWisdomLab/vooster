export type StoredMergeRequest = {
  conflicts: Array<{ entity_id: string; type: string }>;
  created_by?: string;
  id: string;
  impact: {
    affected_branches: string[];
    affected_sessions: string[];
    severity_by_entity: Record<string, string>;
  };
  source_branch_id: null | string;
  status: "CLOSED" | "MERGED" | "OPEN";
  strategy: "FAST_FORWARD";
  target_branch_id: string;
  resolved_at?: string;
};
