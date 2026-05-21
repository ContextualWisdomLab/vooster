import { Args, Command, Flags } from "@oclif/core";

import { requiredFlag } from "../flag-values.js";
import { postJson } from "../http-client.js";

type StakeholderCliFlags = {
  "api-url"?: string;
  description?: string;
  name?: string;
  "project-id"?: string;
  "session-cookie"?: string;
  type?: string;
};

type StakeholderFlags = {
  apiUrl: string;
  description: string;
  name: string;
  projectId: string;
  sessionCookie: string;
  type: "EXTERNAL" | "INTERNAL" | "REGULATORY";
};

type StakeholderResponse = {
  recommended_next_command: string;
  revision: {
    version_number: number;
  };
  stakeholder: {
    name: string;
    type: string;
  };
};

export class StakeholderCommand extends Command {
  static override description = "Manage project stakeholders.";

  static override args = {
    action: Args.string()
  };

  static override flags = {
    "api-url": Flags.string(),
    description: Flags.string(),
    name: Flags.string(),
    "project-id": Flags.string(),
    "session-cookie": Flags.string(),
    type: Flags.string()
  };

  override async run(): Promise<void> {
    const parsed = await this.parse(StakeholderCommand);

    await runStakeholder(parsed.flags, parsed.args.action, this.log.bind(this));
  }
}

export async function runStakeholder(
  flags: StakeholderCliFlags,
  action: string | undefined,
  writeLine: (message: string) => void
): Promise<void> {
  if (action !== "create") {
    throw new Error("Missing stakeholder action.");
  }

  const stakeholderFlags = stakeholderFlagsFrom(flags);
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
  const body = response.body as StakeholderResponse;

  writeLine(`Stakeholder ${body.stakeholder.name} ${body.stakeholder.type}`);
  writeLine(`Revision version ${String(body.revision.version_number)}`);
  writeLine(body.recommended_next_command);
}

function stakeholderFlagsFrom(flags: StakeholderCliFlags): StakeholderFlags {
  return {
    apiUrl: requiredFlag(flags, "api-url"),
    description: flags.description ?? "",
    name: requiredFlag(flags, "name"),
    projectId: requiredFlag(flags, "project-id"),
    sessionCookie: requiredFlag(flags, "session-cookie"),
    type: stakeholderType(requiredFlag(flags, "type"))
  };
}

function stakeholderType(rawType: string): "EXTERNAL" | "INTERNAL" | "REGULATORY" {
  const type = rawType.toUpperCase();
  if (type === "EXTERNAL" || type === "INTERNAL" || type === "REGULATORY") {
    return type;
  }

  throw new Error("Stakeholder type must be INTERNAL, EXTERNAL, or REGULATORY.");
}
