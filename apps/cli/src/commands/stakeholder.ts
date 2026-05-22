import { Args, Command, Flags } from "@oclif/core";

import {
  stakeholderCreateFlagsFrom,
  stakeholderPatchFrom,
  type StakeholderCliFlags
} from "./stakeholder-flags.js";
import {
  printStakeholderCreated,
  printStakeholderSummary,
  type StakeholderListResponse,
  type StakeholderResponse,
  type StakeholderSummary
} from "./stakeholder-output.js";
import { buildAgentEnvelope } from "../agent-envelope.js";
import { requiredArgument, requiredFlag, resolveContextFlag } from "../flag-values.js";
import { deleteJson, fetchJson, patchJson, postJson } from "../http-client.js";

export class StakeholderCommand extends Command {
  static override description = "Manage project stakeholders.";

  static override args = {
    action: Args.string(),
    stakeholderId: Args.string()
  };

  static override flags = {
    "api-url": Flags.string(),
    description: Flags.string(),
    format: Flags.string(),
    name: Flags.string(),
    "project-id": Flags.string(),
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
  await deleteJson(stakeholderUrl(flags, id), authHeaders(flags));

  if (flags.format === "agent") {
    writeLine(JSON.stringify(buildAgentEnvelope({ data: { archived: true, stakeholder_id: id } }), null, 2));
    return;
  }

  writeLine(`Archived ${id}`);
}

async function editStakeholder(
  flags: StakeholderCliFlags,
  stakeholderId: string | undefined,
  writeLine: (message: string) => void
): Promise<void> {
  const response = await patchJson(
    stakeholderUrl(flags, requiredArgument(stakeholderId, "stakeholder id")),
    stakeholderPatchFrom(flags),
    authHeaders(flags)
  );
  if (flags.format === "agent") {
    writeLine(JSON.stringify(buildAgentEnvelope({ data: response.body }), null, 2));
    return;
  }
  printStakeholderSummary(
    (response.body as { stakeholder: StakeholderSummary }).stakeholder,
    writeLine
  );
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
  if (flags.format === "agent") {
    writeLine(JSON.stringify(buildAgentEnvelope({ data: response.body }), null, 2));
    return;
  }
  printStakeholderSummary(
    (response.body as { stakeholder: StakeholderSummary }).stakeholder,
    writeLine
  );
}

async function createStakeholder(
  flags: StakeholderCliFlags,
  writeLine: (message: string) => void
): Promise<void> {
  const stakeholderFlags = stakeholderCreateFlagsFrom(flags);
  const response = await postJson(
    `${stakeholderFlags.apiUrl}/v1/projects/${stakeholderFlags.projectId}/stakeholders`,
    {
      description: stakeholderFlags.description,
      name: stakeholderFlags.name,
      type: stakeholderFlags.type
    },
    {
      Cookie: stakeholderFlags.sessionCookie
    }
  );
  if (flags.format === "agent") {
    writeLine(JSON.stringify(buildAgentEnvelope({ data: response.body }), null, 2));
    return;
  }
  printStakeholderCreated(response.body as StakeholderResponse, writeLine);
}

async function listStakeholders(
  flags: StakeholderCliFlags,
  writeLine: (message: string) => void
): Promise<void> {
  const response = await fetchJson(stakeholdersUrl(flags), {
    headers: authHeaders(flags)
  });
  const body = response.body as StakeholderListResponse;

  if (flags.format === "agent") {
    writeLine(JSON.stringify(buildAgentEnvelope({ data: body }), null, 2));
    return;
  }

  for (const stakeholder of body.items) {
    printStakeholderSummary(stakeholder, writeLine);
  }
}

function stakeholdersUrl(flags: StakeholderCliFlags): string {
  return `${resolveContextFlag(flags, "api-url")}/v1/projects/${requiredFlag(flags, "project-id")}/stakeholders`;
}

function stakeholderUrl(flags: StakeholderCliFlags, stakeholderId: string): string {
  return `${stakeholdersUrl(flags)}/${stakeholderId}`;
}

function authHeaders(flags: StakeholderCliFlags): Record<string, string> {
  return { Cookie: resolveContextFlag(flags, "session-cookie") };
}
