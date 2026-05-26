import { Args, Command, Flags } from "@oclif/core";
import {
  branchCreateRequestSchema,
  branchCreateResponseSchema,
  type BranchCreateResponse
} from "@vooster/contracts";

import { buildAgentEnvelope } from "../agent-envelope.js";
import { requiredArgument, resolveContextFlag } from "../flag-values.js";
import { postJson } from "../http-client.js";

type BranchCliFlags = {
  "api-url"?: string;
  format?: string;
  from?: string;
  "project-id"?: string;
  "session-cookie"?: string;
};

type BranchCreateFlags = {
  apiUrl: string;
  from: string;
  name: string;
  projectId: string;
  sessionCookie: string;
};

export class BranchCommand extends Command {
  static override description = "Manage spec branches.";

  static override args = {
    action: Args.string(),
    name: Args.string()
  };

  static override flags = {
    "api-url": Flags.string(),
    format: Flags.string(),
    from: Flags.string(),
    "project-id": Flags.string(),
    "session-cookie": Flags.string()
  };

  override async run(): Promise<void> {
    const parsed = await this.parse(BranchCommand);

    await runBranch(
      parsed.flags,
      parsed.args.action,
      parsed.args.name,
      this.log.bind(this)
    );
  }
}

export async function runBranch(
  flags: BranchCliFlags,
  action: string | undefined,
  name: string | undefined,
  writeLine: (message: string) => void
): Promise<void> {
  if (action === "create") {
    await createBranch(flags, name, writeLine);
    return;
  }

  throw new Error("Missing branch action.");
}

async function createBranch(
  flags: BranchCliFlags,
  name: string | undefined,
  writeLine: (message: string) => void
): Promise<void> {
  const branchFlags = branchCreateFlagsFrom(flags, name);
  const body = branchCreateRequestSchema.parse({
    from: branchFlags.from,
    name: branchFlags.name
  });
  const response = await postJson(
    `${branchFlags.apiUrl}/v1/projects/${branchFlags.projectId}/branches`,
    body,
    {
      Cookie: branchFlags.sessionCookie
    }
  );
  const parsedBody: BranchCreateResponse = branchCreateResponseSchema.parse(
    response.body
  );

  if (flags.format === "agent") {
    writeLine(
      JSON.stringify(
        buildAgentEnvelope({
          data: parsedBody,
          context: { branch: parsedBody.branch.name }
        }),
        null,
        2
      )
    );
    return;
  }

  writeLine(`Branch ${parsedBody.branch.id}`);
  writeLine(`Name ${parsedBody.branch.name}`);
  writeLine(`Status ${parsedBody.branch.status}`);
  writeLine(`Owner ${parsedBody.branch.owner_type}`);
  writeLine(
    `Base revisions ${String(Object.keys(parsedBody.branch.base_revision_ids).length)}`
  );
  writeLine(
    `Head revisions ${String(Object.keys(parsedBody.branch.head_revision_ids).length)}`
  );
  for (const warning of parsedBody.warnings ?? []) {
    writeLine(`Warning ${warning.type} ${warning.merge_request_id}`);
  }
  for (const action of parsedBody.suggested_next_actions) {
    writeLine(action.command);
  }
}

function branchCreateFlagsFrom(
  flags: BranchCliFlags,
  name: string | undefined
): BranchCreateFlags {
  return {
    apiUrl: resolveContextFlag(flags, "api-url"),
    from: flags.from ?? "main",
    name: requiredArgument(name, "branch-name"),
    projectId: resolveContextFlag(flags, "project-id"),
    sessionCookie: resolveContextFlag(flags, "session-cookie")
  };
}
