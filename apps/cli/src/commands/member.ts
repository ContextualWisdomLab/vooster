import { Args, Command, Flags } from "@oclif/core";
import {
  invitationCreateRequestSchema,
  invitationCreateResponseSchema,
  type InvitationCreateResponse,
  type InvitationRole
} from "@vooster/contracts";

import { buildAgentEnvelope } from "../agent-envelope.js";
import { requiredFlag, resolveContextFlag } from "../flag-values.js";
import { postJson } from "../http-client.js";

type MemberFlags = {
  "api-url"?: string;
  email?: string;
  format?: string;
  role?: string;
  "session-cookie"?: string;
  "workspace-id"?: string;
};

type InviteFlags = {
  apiUrl: string;
  email: string;
  role: InvitationRole;
  sessionCookie: string;
  workspaceId: string;
};

export class MemberCommand extends Command {
  static override description = "Manage workspace members.";

  static override args = {
    action: Args.string()
  };

  static override flags = {
    "api-url": Flags.string(),
    email: Flags.string(),
    format: Flags.string(),
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
  const requestBody = invitationCreateRequestSchema.parse({
    email: inviteFlags.email,
    role: inviteFlags.role
  });
  const response = await postJson(
    `${inviteFlags.apiUrl}/v1/workspaces/${inviteFlags.workspaceId}/invitations`,
    requestBody,
    {
      Cookie: inviteFlags.sessionCookie
    }
  );
  const body: InvitationCreateResponse = invitationCreateResponseSchema.parse(
    response.body
  );

  if (flags.format === "agent") {
    writeLine(
      JSON.stringify(
        buildAgentEnvelope({
          data: body,
          suggested_next_actions: body.suggested_next_actions
        }),
        null,
        2
      )
    );
    return;
  }

  writeLine(`Invited ${body.invitation.email}`);
  writeLine(`Role ${body.invitation.role}`);
  for (const action of body.suggested_next_actions) {
    writeLine(action.command);
  }
}

function inviteFlagsFrom(flags: MemberFlags): InviteFlags {
  return {
    apiUrl: resolveContextFlag(flags, "api-url"),
    email: requiredFlag(flags, "email"),
    role: invitationRole(requiredFlag(flags, "role")),
    sessionCookie: resolveContextFlag(flags, "session-cookie"),
    workspaceId: resolveContextFlag(flags, "workspace-id")
  };
}

function invitationRole(rawRole: string): InvitationRole {
  const role = rawRole.toUpperCase();
  if (role === "EDITOR" || role === "OWNER") {
    return role;
  }

  throw new Error("Role must be EDITOR or OWNER.");
}
