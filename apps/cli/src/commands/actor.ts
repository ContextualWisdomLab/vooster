import { Args, Command, Flags } from "@oclif/core";

import {
  actorCreateFlagsFrom,
  actorPatchFrom,
  type ActorCliFlags
} from "./actor-flags.js";
import {
  printActorCreated,
  printActorSummary,
  type ActorListResponse,
  type ActorResponse,
  type ActorSummary
} from "./actor-output.js";
import { buildAgentEnvelope } from "../agent-envelope.js";
import {
  commonMutationContextFrom,
  runMutationCommand
} from "../application/mutation-command.js";
import { requiredArgument, resolveContextFlag } from "../flag-values.js";
import { deleteJson, fetchJson, patchJson } from "../http-client.js";

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
  const response = await fetchJson(
    actorUrl(flags, requiredArgument(actorId, "actor id")),
    {
      headers: authHeaders(flags)
    }
  );
  if (flags.format === "agent") {
    writeLine(JSON.stringify(buildAgentEnvelope({ data: response.body }), null, 2));
    return;
  }
  printActorSummary((response.body as { actor: ActorSummary }).actor, writeLine);
}

async function archiveActor(
  flags: ActorCliFlags,
  actorId: string | undefined,
  writeLine: (message: string) => void
): Promise<void> {
  const id = requiredArgument(actorId, "actor id");
  await deleteJson(actorUrl(flags, id), authHeaders(flags));

  if (flags.format === "agent") {
    writeLine(
      JSON.stringify(
        buildAgentEnvelope({ data: { actor_id: id, archived: true } }),
        null,
        2
      )
    );
    return;
  }

  writeLine(`Archived ${id}`);
}

async function editActor(
  flags: ActorCliFlags,
  actorId: string | undefined,
  writeLine: (message: string) => void
): Promise<void> {
  const response = await patchJson(
    actorUrl(flags, requiredArgument(actorId, "actor id")),
    actorPatchFrom(flags),
    authHeaders(flags)
  );
  if (flags.format === "agent") {
    writeLine(JSON.stringify(buildAgentEnvelope({ data: response.body }), null, 2));
    return;
  }
  printActorSummary((response.body as { actor: ActorSummary }).actor, writeLine);
}

async function createActor(
  flags: ActorCliFlags,
  writeLine: (message: string) => void
): Promise<void> {
  const actorFlags = actorCreateFlagsFrom(flags);
  await runMutationCommand<ActorResponse>(
    {
      body: {
        aliases: actorFlags.aliases,
        description: actorFlags.description,
        is_human: true,
        name: actorFlags.name,
        type: actorFlags.type
      },
      method: "POST",
      path: `/v1/projects/${actorFlags.projectId}/actors`
    },
    commonMutationContextFrom(actorFlags),
    { format: flags.format, human: printActorCreated, writeLine }
  );
}

async function listActors(
  flags: ActorCliFlags,
  writeLine: (message: string) => void
): Promise<void> {
  const response = await fetchJson(actorsUrl(flags), {
    headers: authHeaders(flags)
  });
  const body = response.body as ActorListResponse;

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
