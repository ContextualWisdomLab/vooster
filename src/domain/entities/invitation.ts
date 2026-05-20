export type StoredInvitation = {
  accepted_at: null | string;
  delivery_status: "FAILED" | "SENT";
  email: string;
  expires_at: string;
  id: string;
  role: "EDITOR" | "OWNER";
  token: string;
  workspace_id: string;
};
