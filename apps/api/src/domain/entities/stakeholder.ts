export type StoredStakeholder = {
  id: string;
  project_id: string;
  name: string;
  type: "EXTERNAL" | "INTERNAL" | "REGULATORY";
  description: string;
  archived_at: null | string;
};
