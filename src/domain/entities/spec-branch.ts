export type StoredSpecBranch = {
  base_revision_ids?: Record<string, string>;
  id: string;
  project_id: string;
  name: string;
  owner_type: "AGENT" | "HUMAN";
  owner_id: string;
  base_branch_id: null | string;
  head_revision_ids?: Record<string, string>;
  merged_at?: string;
  status?: "ABANDONED" | "ACTIVE" | "MERGED";
};
