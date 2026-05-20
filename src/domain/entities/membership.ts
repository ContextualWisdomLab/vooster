export type StoredMembership = {
  id: string;
  user_id: string;
  workspace_id: string;
  role: "EDITOR" | "OWNER";
};
