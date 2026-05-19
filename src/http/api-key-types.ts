export type StoredApiKey = {
  created_at: string;
  created_by: string;
  id: string;
  name: string;
  revoked_at: null | string;
  scopes: Array<"read" | "write">;
  token_hash: string;
  workspace_id: string;
};
