import { Args, Command, Flags } from "@oclif/core";

import { requiredFlag } from "../flag-values.js";
import { postJson } from "../http-client.js";

type MemberFlags = {
  "api-url"?: string;
  email?: string;
  role?: string;
  "session-cookie"?: string;
  "workspace-id"?: string;
};

type InviteFlags = {
  apiUrl: string;
  email: string;
  role: "EDITOR" | "OWNER";
  sessionCookie: string;
  workspaceId: string;
};

type InvitationResponse = {
  invitation: {
    email: string;
    role: string;
  };
  suggested_next_actions: Array<{
    command: string;
  }>;
};

export class MemberCommand extends Command {
  static override description = "Manage workspace members.";

  static override args = {
    action: Args.string()
  };

  static override flags = {
    "api-url": Flags.string(),
    email: Flags.string(),
    role: Flags.string(),
    "session-cookie": Flags.string(),
    "workspace-id": Flags.string()
  };

  override async run(): Promise<void> {
    const parsed = await this.parse(MemberCommand);

    await runMember(parsed.flags, parsed.args.action, this.log.bind(this));
  }
}

export async function runMember(
  flags: MemberFlags,
  action: string | undefined,
  writeLine: (message: string) => void
): Promise<void> {
  if (action === "invite") {
    await inviteMember(flags, writeLine);
    return;
  }

  throw new Error("Missing member action.");
}

async function inviteMember(
  flags: MemberFlags,
  writeLine: (message: string) => void
): Promise<void> {
  const inviteFlags = inviteFlagsFrom(flags);
  const response = await postJson(
    `${inviteFlags.apiUrl}/v1/workspaces/${inviteFlags.workspaceId}/invitations`,
    {
      email: inviteFlags.email,
      role: inviteFlags.role
    },
    {
      Cookie: inviteFlags.sessionCookie
    }
  );
  const body = response.body as InvitationResponse;

  writeLine(`Invited ${body.invitation.email}`);
  writeLine(`Role ${body.invitation.role}`);
  for (const action of body.suggested_next_actions) {
    writeLine(action.command);
  }
}

function inviteFlagsFrom(flags: MemberFlags): InviteFlags {
  return {
    apiUrl: requiredFlag(flags, "api-url"),
    email: requiredFlag(flags, "email"),
    role: invitationRole(requiredFlag(flags, "role")),
    sessionCookie: requiredFlag(flags, "session-cookie"),
    workspaceId: requiredFlag(flags, "workspace-id")
  };
}

function invitationRole(rawRole: string): "EDITOR" | "OWNER" {
  const role = rawRole.toUpperCase();
  if (role === "EDITOR" || role === "OWNER") {
    return role;
  }

  throw new Error("Role must be EDITOR or OWNER.");
}
