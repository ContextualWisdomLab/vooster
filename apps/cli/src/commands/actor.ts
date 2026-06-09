import { Args, Command, Flags } from "@oclif/core";
import {
  actorArchiveResponseSchema,
  actorCreateResponseSchema,
  actorListResponseSchema,
  actorPatchRequestSchema,
  actorResponseSchema,
  type ActorCreateResponse,
  type ActorListResponse
} from "@vooster/contracts";

import {
  actorCreateFlagsFrom,
  actorPatchFrom,
  type ActorCliFlags
} from "./actor-flags.js";
import { printActorCreated, printActorSummary } from "./actor-output.js";
import { buildAgentEnvelope } from "../agent-envelope.js";
import {
  commonMutationContextFrom,
  runMutationCommand
} from "../application/mutation-command.js";
import {
  buildErrorEnvelope,
  type AgentEnvelopeV2,
  type EnvelopeError,
  type SuggestedNextAction
} from "../domain/envelope.js";
import { extractError, extractSuggestedNextActions } from "../domain/error-codes.js";
import { requiredArgument, resolveContextFlag } from "../flag-values.js";
import {
  deleteJson,
  fetchJson,
  isApiError,
  patchJson,
  type ApiError
} from "../http-client.js";

export class ActorCommand extends Command {
  static override description = "Manage project actors.";

  static override args = {
    action: Args.string(),
    actorId: Args.string()
  };

  static override flags = {
    aliases: Flags.string(),
    "api-url": Flags.string(),
    branch: Flags.string(),
    description: Flags.string(),
    "dry-run": Flags.boolean(),
    format: Flags.string(),
    human: Flags.boolean(),
    name: Flags.string(),
    "project-id": Flags.string(),
    root: Flags.string(),
    "session-cookie": Flags.string(),
    type: Flags.string()
  };

  override async run(): Promise<void> {
    const parsed = await this.parse(ActorCommand);

    await runActor(
      parsed.flags,
      parsed.args.action,
      parsed.args.actorId,
      this.log.bind(this)
    );
  }
}

export async function runActor(
  flags: ActorCliFlags,
  action: string | undefined,
  actorId: string | undefined,
  writeLine: (message: string) => void
): Promise<void> {
  if (action === "create") {
    await createActor(flags, writeLine);
    return;
  }
  if (action === "list") {
    await listActors(flags, writeLine);
    return;
  }
  if (action === "show") {
    await showActor(flags, actorId, writeLine);
    return;
  }
  if (action === "edit") {
    await editActor(flags, actorId, writeLine);
    return;
  }
  if (action === "archive") {
    await archiveActor(flags, actorId, writeLine);
    return;
  }

  throw new Error("Missing actor action.");
}

async function showActor(
  flags: ActorCliFlags,
  actorId: string | undefined,
  writeLine: (message: string) => void
): Promise<void> {
  const id = requiredArgument(actorId, "actor id");
  const response = await actorApiRequest(
    flags,
    writeLine,
    () =>
      fetchJson(actorUrl(flags, id), {
        headers: authHeaders(flags)
      }),
    id
  );
  if (response === undefined) return;

  const body = actorResponseSchema.parse(response.body);
  if (flags.format === "agent") {
    writeLine(JSON.stringify(buildAgentEnvelope({ data: body }), null, 2));
    return;
  }
  printActorSummary(body.actor, writeLine);
}

async function archiveActor(
  flags: ActorCliFlags,
  actorId: string | undefined,
  writeLine: (message: string) => void
): Promise<void> {
  const id = requiredArgument(actorId, "actor id");
  const response = await actorApiRequest(
    flags,
    writeLine,
    () => deleteJson(actorUrl(flags, id), authHeaders(flags)),
    id
  );
  if (response === undefined) return;

  const body = actorArchiveResponseSchema.parse(response.body);

  if (flags.format === "agent") {
    writeLine(JSON.stringify(buildAgentEnvelope({ data: body }), null, 2));
    return;
  }

  writeLine(`Archived ${id}`);
}

async function editActor(
  flags: ActorCliFlags,
  actorId: string | undefined,
  writeLine: (message: string) => void
): Promise<void> {
  const patch = actorPatchRequestSchema.parse(actorPatchFrom(flags));
  const id = requiredArgument(actorId, "actor id");
  const response = await actorApiRequest(
    flags,
    writeLine,
    () => patchJson(actorUrl(flags, id), patch, authHeaders(flags)),
    id
  );
  if (response === undefined) return;

  const body = actorResponseSchema.parse(response.body);
  if (flags.format === "agent") {
    writeLine(JSON.stringify(buildAgentEnvelope({ data: body }), null, 2));
    return;
  }
  printActorSummary(body.actor, writeLine);
}

async function createActor(
  flags: ActorCliFlags,
  writeLine: (message: string) => void
): Promise<void> {
  const actorFlags = actorCreateFlagsFrom(flags);
  await runMutationCommand<ActorCreateResponse>(
    {
      body: {
        aliases: actorFlags.aliases,
        description: actorFlags.description,
        is_human: true,
        name: actorFlags.name,
        type: actorFlags.type
      },
      method: "POST",
      path: `/v1/projects/${actorFlags.projectId}/actors`,
      selectData: (responseBody) => actorCreateResponseSchema.parse(responseBody)
    },
    commonMutationContextFrom(actorFlags),
    { format: flags.format, human: printActorCreated, writeLine }
  );
}

async function listActors(
  flags: ActorCliFlags,
  writeLine: (message: string) => void
): Promise<void> {
  const response = await actorApiRequest(flags, writeLine, () =>
    fetchJson(actorsUrl(flags), {
      headers: authHeaders(flags)
    })
  );
  if (response === undefined) return;

  const body: ActorListResponse = actorListResponseSchema.parse(response.body);

  if (flags.format === "agent") {
    writeLine(JSON.stringify(buildAgentEnvelope({ data: body }), null, 2));
    return;
  }

  for (const actor of body.items) {
    printActorSummary(actor, writeLine);
  }
}

function authHeaders(flags: ActorCliFlags): Record<string, string> {
  return { Cookie: resolveContextFlag(flags, "session-cookie") };
}

function actorsUrl(flags: ActorCliFlags): string {
  return `${resolveContextFlag(flags, "api-url")}/v1/projects/${resolveContextFlag(flags, "project-id")}/actors`;
}

function actorUrl(flags: ActorCliFlags, actorId: string): string {
  return `${actorsUrl(flags)}/${actorId}`;
}

async function actorApiRequest<TResponse>(
  flags: ActorCliFlags,
  writeLine: (message: string) => void,
  request: () => Promise<TResponse>,
  actorLookup?: string
): Promise<TResponse | undefined> {
  try {
    return await request();
  } catch (error: unknown) {
    if (!isApiError(error)) {
      throw error;
    }

    writeActorApiError(flags, error, actorLookup, writeLine);
    return undefined;
  }
}

function writeActorApiError(
  flags: ActorCliFlags,
  error: ApiError,
  actorLookup: string | undefined,
  writeLine: (message: string) => void
): void {
  const envelope = buildErrorEnvelope({
    error: actorError(error, actorLookup),
    suggestedNextActions: actorErrorActions(error, actorLookup)
  });

  if (flags.format === "agent") {
    writeLine(JSON.stringify(envelope, null, 2));
  } else {
    printActorHumanError(envelope, writeLine);
  }
  process.exitCode = 1;
}

function actorError(error: ApiError, actorLookup: string | undefined): EnvelopeError {
  const extracted = extractError(error.status, error.body);
  if (!isUnresolvedActorLookup(error, actorLookup)) {
    return extracted;
  }

  return {
    ...extracted,
    message: `Actor "${actorLookup}" was not found. Actor commands resolve actors by id, not display name. Run vspec actor list and retry with the listed id.`
  };
}

function actorErrorActions(
  error: ApiError,
  actorLookup: string | undefined
): SuggestedNextAction[] {
  if (!isUnresolvedActorLookup(error, actorLookup)) {
    return extractSuggestedNextActions(error.body);
  }

  return [
    {
      command: "vspec actor list",
      reason: "Find the actor id, then retry this command with the listed id."
    }
  ];
}

function isUnresolvedActorLookup(
  error: ApiError,
  actorLookup: string | undefined
): actorLookup is string {
  return actorLookup !== undefined && error.status === 404;
}

function printActorHumanError(
  envelope: AgentEnvelopeV2<null>,
  writeLine: (message: string) => void
): void {
  writeLine(`Error: ${envelope.error?.message ?? "Actor command failed."}`);
  if (envelope.suggested_next_actions.length === 0) {
    return;
  }

  writeLine("Next actions");
  for (const action of envelope.suggested_next_actions) {
    writeLine(`  ${action.command}${action.reason ? ` - ${action.reason}` : ""}`);
  }
}
