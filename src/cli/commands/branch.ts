import { Args, Command, Flags } from "@oclif/core";

import { requiredArgument, requiredFlag } from "../flag-values.js";
import { postJson } from "../http-client.js";

type BranchCliFlags = {
  "api-url"?: string;
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

type BranchCreateResponse = {
  branch: {
    base_revision_ids: Record<string, string>;
    head_revision_ids: Record<string, string>;
    id: string;
    name: string;
    owner_type: string;
    status: string;
  };
  suggested_next_actions: Array<{
    command: string;
  }>;
  warnings?: Array<{
    merge_request_id: string;
    type: string;
  }>;
};

export class BranchCommand extends Command {
  static override description = "Manage spec branches.";

  static override args = {
    action: Args.string(),
    name: Args.string()
  };

  static override flags = {
    "api-url": Flags.string(),
    from: Flags.string(),
    "project-id": Flags.string(),
    "session-cookie": Flags.string()
  };

  override async run(): Promise<void> {
    const parsed = await this.parse(BranchCommand);

    await runBranch(parsed.flags, parsed.args.action, parsed.args.name, this.log.bind(this));
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
  const response = await postJson(
    `${branchFlags.apiUrl}/v1/projects/${branchFlags.projectId}/branches`,
    {
      from: branchFlags.from,
      name: branchFlags.name
    },
    {
      Cookie: branchFlags.sessionCookie
    }
  );
  const body = response.body as BranchCreateResponse;

  writeLine(`Branch ${body.branch.id}`);
  writeLine(`Name ${body.branch.name}`);
  writeLine(`Status ${body.branch.status}`);
  writeLine(`Owner ${body.branch.owner_type}`);
  writeLine(`Base revisions ${String(Object.keys(body.branch.base_revision_ids).length)}`);
  writeLine(`Head revisions ${String(Object.keys(body.branch.head_revision_ids).length)}`);
  for (const warning of body.warnings ?? []) {
    writeLine(`Warning ${warning.type} ${warning.merge_request_id}`);
  }
  for (const action of body.suggested_next_actions) {
    writeLine(action.command);
  }
}

function branchCreateFlagsFrom(
  flags: BranchCliFlags,
  name: string | undefined
): BranchCreateFlags {
  return {
    apiUrl: requiredFlag(flags, "api-url"),
    from: flags.from ?? "main",
    name: requiredArgument(name, "branch-name"),
    projectId: requiredFlag(flags, "project-id"),
    sessionCookie: requiredFlag(flags, "session-cookie")
  };
}
