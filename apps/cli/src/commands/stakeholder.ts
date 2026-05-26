import { Args, Command, Flags } from "@oclif/core";
import {
  stakeholderArchiveResponseSchema,
  stakeholderCreateResponseSchema,
  stakeholderListResponseSchema,
  stakeholderPatchRequestSchema,
  stakeholderResponseSchema,
  type StakeholderCreateResponse,
  type StakeholderListResponse
} from "@vooster/contracts";

import {
  stakeholderCreateFlagsFrom,
  stakeholderPatchFrom,
  type StakeholderCliFlags
} from "./stakeholder-flags.js";
import {
  printStakeholderCreated,
  printStakeholderSummary
} from "./stakeholder-output.js";
import { buildAgentEnvelope } from "../agent-envelope.js";
import {
  commonMutationContextFrom,
  runMutationCommand
} from "../application/mutation-command.js";
import { requiredArgument, resolveContextFlag } from "../flag-values.js";
import { deleteJson, fetchJson, patchJson } from "../http-client.js";

export class StakeholderCommand extends Command {
  static override description = "Manage project stakeholders.";

  static override args = {
    action: Args.string(),
    stakeholderId: Args.string()
  };

  static override flags = {
    "api-url": Flags.string(),
    branch: Flags.string(),
    description: Flags.string(),
    "dry-run": Flags.boolean(),
    format: Flags.string(),
    name: Flags.string(),
    "project-id": Flags.string(),
    root: Flags.string(),
    "session-cookie": Flags.string(),
    type: Flags.string()
  };

  override async run(): Promise<void> {
    const parsed = await this.parse(StakeholderCommand);

    await runStakeholder(
      parsed.flags,
      parsed.args.action,
      parsed.args.stakeholderId,
      this.log.bind(this)
    );
  }
}

export async function runStakeholder(
  flags: StakeholderCliFlags,
  action: string | undefined,
  stakeholderId: string | undefined,
  writeLine: (message: string) => void
): Promise<void> {
  if (action === "create") {
    await createStakeholder(flags, writeLine);
    return;
  }
  if (action === "list") {
    await listStakeholders(flags, writeLine);
    return;
  }
  if (action === "show") {
    await showStakeholder(flags, stakeholderId, writeLine);
    return;
  }
  if (action === "edit") {
    await editStakeholder(flags, stakeholderId, writeLine);
    return;
  }
  if (action === "archive") {
    await archiveStakeholder(flags, stakeholderId, writeLine);
    return;
  }

  throw new Error("Missing stakeholder action.");
}

async function archiveStakeholder(
  flags: StakeholderCliFlags,
  stakeholderId: string | undefined,
  writeLine: (message: string) => void
): Promise<void> {
  const id = requiredArgument(stakeholderId, "stakeholder id");
  const response = await deleteJson(stakeholderUrl(flags, id), authHeaders(flags));
  const body = stakeholderArchiveResponseSchema.parse(response.body);

  if (flags.format === "agent") {
    writeLine(JSON.stringify(buildAgentEnvelope({ data: body }), null, 2));
    return;
  }

  writeLine(`Archived ${id}`);
}

async function editStakeholder(
  flags: StakeholderCliFlags,
  stakeholderId: string | undefined,
  writeLine: (message: string) => void
): Promise<void> {
  const patch = stakeholderPatchRequestSchema.parse(stakeholderPatchFrom(flags));
  const response = await patchJson(
    stakeholderUrl(flags, requiredArgument(stakeholderId, "stakeholder id")),
    patch,
    authHeaders(flags)
  );
  const body = stakeholderResponseSchema.parse(response.body);
  if (flags.format === "agent") {
    writeLine(JSON.stringify(buildAgentEnvelope({ data: body }), null, 2));
    return;
  }
  printStakeholderSummary(body.stakeholder, writeLine);
}

async function showStakeholder(
  flags: StakeholderCliFlags,
  stakeholderId: string | undefined,
  writeLine: (message: string) => void
): Promise<void> {
  const response = await fetchJson(
    stakeholderUrl(flags, requiredArgument(stakeholderId, "stakeholder id")),
    { headers: authHeaders(flags) }
  );
  const body = stakeholderResponseSchema.parse(response.body);
  if (flags.format === "agent") {
    writeLine(JSON.stringify(buildAgentEnvelope({ data: body }), null, 2));
    return;
  }
  printStakeholderSummary(body.stakeholder, writeLine);
}

async function createStakeholder(
  flags: StakeholderCliFlags,
  writeLine: (message: string) => void
): Promise<void> {
  const stakeholderFlags = stakeholderCreateFlagsFrom(flags);
  await runMutationCommand<StakeholderCreateResponse>(
    {
      body: {
        description: stakeholderFlags.description,
        name: stakeholderFlags.name,
        type: stakeholderFlags.type
      },
      method: "POST",
      path: `/v1/projects/${stakeholderFlags.projectId}/stakeholders`,
      selectData: (responseBody) => stakeholderCreateResponseSchema.parse(responseBody)
    },
    commonMutationContextFrom(stakeholderFlags),
    { format: flags.format, human: printStakeholderCreated, writeLine }
  );
}

async function listStakeholders(
  flags: StakeholderCliFlags,
  writeLine: (message: string) => void
): Promise<void> {
  const response = await fetchJson(stakeholdersUrl(flags), {
    headers: authHeaders(flags)
  });
  const body: StakeholderListResponse = stakeholderListResponseSchema.parse(
    response.body
  );

  if (flags.format === "agent") {
    writeLine(JSON.stringify(buildAgentEnvelope({ data: body }), null, 2));
    return;
  }

  for (const stakeholder of body.items) {
    printStakeholderSummary(stakeholder, writeLine);
  }
}

function stakeholdersUrl(flags: StakeholderCliFlags): string {
  return `${resolveContextFlag(flags, "api-url")}/v1/projects/${resolveContextFlag(flags, "project-id")}/stakeholders`;
}

function stakeholderUrl(flags: StakeholderCliFlags, stakeholderId: string): string {
  return `${stakeholdersUrl(flags)}/${stakeholderId}`;
}

function authHeaders(flags: StakeholderCliFlags): Record<string, string> {
  return { Cookie: resolveContextFlag(flags, "session-cookie") };
}
