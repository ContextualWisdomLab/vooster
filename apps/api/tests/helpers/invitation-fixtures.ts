import type { TestServer } from "./server.js";

export type Invitation = {
  accepted_at: null | string;
  delivery_status: "SENT" | "FAILED";
  email: string;
  expires_at: string;
  id: string;
  role: "EDITOR" | "OWNER";
  token: string;
  workspace_id: string;
};
export type InvitationResponse = {
  invitation: Invitation;
  suggested_next_actions: Array<{ command: string; reason: string }>;
};
export type AcceptanceResponse = {
  invitation: Invitation;
  membership: { role: "EDITOR" | "OWNER"; user_id: string; workspace_id: string };
  user: { email: string; id: string };
};
export type ProblemResponse = {
  code?: string;
  suggested_next_actions: Array<{ command: string; reason: string }>;
};

export function inviteMember(
  server: TestServer,
  workspaceId: string,
  cookie: string,
  email: string,
  role: "EDITOR" | "OWNER",
  extra: Record<string, unknown> = {}
) {
  return server.fetch(`/v1/workspaces/${workspaceId}/invitations`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ email, role, ...extra })
  });
}

export function acceptInvitation(server: TestServer, token: string, code: string) {
  return server.fetch(`/v1/invitations/${token}/accept`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code })
  });
}
