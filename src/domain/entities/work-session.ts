export type StoredAgentType = "CLAUDE_CODE" | "CODEX" | "CURSOR" | "HUMAN" | "OTHER" | "WINDSURF";

export type StoredWorkSession = {
  agent_identifier?: string;
  agent_type?: StoredAgentType;
  branch_id?: null | string;
  ended_at?: string;
  id: string;
  intent?: string;
  last_activity_at?: string;
  pinned_revision_id?: string;
  pinned_revisions?: Record<string, string>;
  project_id?: string;
  started_at?: string;
  status: "ABANDONED" | "ACTIVE" | "COMPLETED";
  usecase_id?: string;
  user_id?: string;
};
