import { Args, Command, Flags } from "@oclif/core";

import { buildAgentEnvelope } from "../agent-envelope.js";
import {
  optionalFlag,
  requiredArgument,
  requiredFlag,
  resolveContextFlag
} from "../flag-values.js";
import { postJson } from "../http-client.js";

type RevertCliFlags = {
  "api-url"?: string;
  force?: boolean;
  format?: string;
  "session-cookie"?: string;
  summary?: string;
  to?: string;
};

type RevertFlags = {
  apiUrl: string;
  force: boolean;
  revisionId: string;
  sessionCookie: string;
  summary: string | undefined;
  usecaseId: string;
};

type RevertResponse = {
  impact: {
    affected_branches: string[];
    affected_sessions: string[];
    severity: string;
  };
  revision: {
    change_summary: string;
    id: string;
    parent_revision_id: string;
    severity: string;
    version_number: number;
  };
  suggested_next_actions: Array<{
    command: string;
  }>;
  usecase: {
    current_revision_id: string;
    id: string;
    title: string;
  };
  warnings?: Array<{
    message: string;
    type: string;
  }>;
};

export class RevertCommand extends Command {
  static override description = "Revert a use case to a previous revision.";

  static override args = {
    usecase: Args.string()
  };

  static override flags = {
    "api-url": Flags.string(),
    force: Flags.boolean(),
    format: Flags.string(),
    "session-cookie": Flags.string(),
    summary: Flags.string(),
    to: Flags.string()
  };

  override async run(): Promise<void> {
    const parsed = await this.parse(RevertCommand);

    await runRevert(parsed.flags, parsed.args.usecase, this.log.bind(this));
  }
}

export async function runRevert(
  flags: RevertCliFlags,
  usecaseId: string | undefined,
  writeLine: (message: string) => void
): Promise<void> {
  const revertFlags = revertFlagsFrom(flags, usecaseId);
  const response = await postJson(
    `${revertFlags.apiUrl}/v1/usecases/${revertFlags.usecaseId}/revert`,
    {
      force: revertFlags.force,
      revision_id: revertFlags.revisionId,
      ...(revertFlags.summary === undefined ? {} : { summary: revertFlags.summary })
    },
    {
      Cookie: revertFlags.sessionCookie
    }
  );
  const body = response.body as RevertResponse;

  if (flags.format === "agent") {
    writeLine(
      JSON.stringify(
        buildAgentEnvelope({
          data: body,
          context: {
            revision: body.revision.id
          },
          suggested_next_actions: body.suggested_next_actions,
          warnings: body.warnings ?? []
        }),
        null,
        2
      )
    );
    return;
  }

  writeLine(`UseCase ${body.usecase.id}`);
  writeLine(`Title ${body.usecase.title}`);
  writeLine(`Current revision ${body.usecase.current_revision_id}`);
  writeLine(`Revision ${body.revision.id}`);
  writeLine(`Parent ${body.revision.parent_revision_id}`);
  writeLine(`Change ${body.revision.change_summary}`);
  writeLine(`Version ${String(body.revision.version_number)}`);
  writeLine(`Severity ${body.revision.severity}`);
  writeLine(`Impact ${body.impact.severity}`);
  writeLine(`Affected sessions ${body.impact.affected_sessions.join(", ") || "none"}`);
  writeLine(`Affected branches ${body.impact.affected_branches.join(", ") || "none"}`);
  for (const warning of body.warnings ?? []) {
    writeLine(`Warning ${warning.type} ${warning.message}`);
  }
  for (const action of body.suggested_next_actions) {
    writeLine(action.command);
  }
}

function revertFlagsFrom(
  flags: RevertCliFlags,
  usecaseId: string | undefined
): RevertFlags {
  return {
    apiUrl: resolveContextFlag(flags, "api-url"),
    force: flags.force ?? false,
    revisionId: requiredFlag(flags, "to"),
    sessionCookie: resolveContextFlag(flags, "session-cookie"),
    summary: optionalFlag(flags, "summary"),
    usecaseId: requiredArgument(usecaseId, "usecase-id")
  };
}
