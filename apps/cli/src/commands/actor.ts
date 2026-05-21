import { Args, Command, Flags } from "@oclif/core";

import { requiredFlag, resolveContextFlag } from "../flag-values.js";
import { postJson } from "../http-client.js";

type ActorCliFlags = {
  aliases?: string;
  "api-url"?: string;
  description?: string;
  name?: string;
  "project-id"?: string;
  "session-cookie"?: string;
  type?: string;
};

type ActorFlags = {
  aliases: string[];
  apiUrl: string;
  description: string;
  name: string;
  projectId: string;
  sessionCookie: string;
  type: "OFFSTAGE" | "PRIMARY" | "SUPPORTING";
};

type ActorResponse = {
  actor: {
    id: string;
    name: string;
    type: string;
  };
  recommended_next_command: string;
  revision: {
    version_number: number;
  };
};

export class ActorCommand extends Command {
  static override description = "Manage project actors.";

  static override args = {
    action: Args.string()
  };

  static override flags = {
    aliases: Flags.string(),
    "api-url": Flags.string(),
    description: Flags.string(),
    name: Flags.string(),
    "project-id": Flags.string(),
    "session-cookie": Flags.string(),
    type: Flags.string()
  };

  override async run(): Promise<void> {
    const parsed = await this.parse(ActorCommand);

    await runActor(parsed.flags, parsed.args.action, this.log.bind(this));
  }
}

export async function runActor(
  flags: ActorCliFlags,
  action: string | undefined,
  writeLine: (message: string) => void
): Promise<void> {
  if (action !== "create") {
    throw new Error("Missing actor action.");
  }

  const actorFlags = actorFlagsFrom(flags);
  const response = await postJson(
    `${actorFlags.apiUrl}/v1/projects/${actorFlags.projectId}/actors`,
    {
      aliases: actorFlags.aliases,
      description: actorFlags.description,
      is_human: true,
      name: actorFlags.name,
      type: actorFlags.type
    },
    {
      Cookie: actorFlags.sessionCookie
    }
  );
  const body = response.body as ActorResponse;

  writeLine(`Actor ${body.actor.name} ${body.actor.type}`);
  writeLine(`Actor id ${body.actor.id}`);
  writeLine(`Revision version ${String(body.revision.version_number)}`);
  writeLine(body.recommended_next_command);
}

function actorFlagsFrom(flags: ActorCliFlags): ActorFlags {
  return {
    aliases: aliasesFrom(flags.aliases),
    apiUrl: resolveContextFlag(flags, "api-url"),
    description: flags.description ?? "",
    name: requiredFlag(flags, "name"),
    projectId: requiredFlag(flags, "project-id"),
    sessionCookie: resolveContextFlag(flags, "session-cookie"),
    type: actorType(requiredFlag(flags, "type"))
  };
}

function actorType(rawType: string): "OFFSTAGE" | "PRIMARY" | "SUPPORTING" {
  const type = rawType.toUpperCase();
  if (type === "OFFSTAGE" || type === "PRIMARY" || type === "SUPPORTING") {
    return type;
  }

  throw new Error("Actor type must be PRIMARY, SUPPORTING, or OFFSTAGE.");
}

function aliasesFrom(rawAliases: string | undefined): string[] {
  if (rawAliases === undefined || rawAliases.trim() === "") {
    return [];
  }

  return rawAliases.split(",").map((alias) => alias.trim()).filter(Boolean);
}
