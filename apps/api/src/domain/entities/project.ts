export type StoredProject = {
  id: string;
  workspace_id: string;
  name: string;
  key: string;
  visibility: "INTERNAL" | "PRIVATE";
  default_branch_id: string;
};
