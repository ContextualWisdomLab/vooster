import { Args, Command, Flags } from "@oclif/core";

import { requiredFlag } from "../flag-values.js";
import { postJson } from "../http-client.js";

type ProjectCliFlags = {
  "api-url"?: string;
  key?: string;
  name?: string;
  "session-cookie"?: string;
  visibility?: string;
  "workspace-id"?: string;
};

type ProjectFlags = {
  apiUrl: string;
  key: string;
  name: string;
  sessionCookie: string;
  visibility: "INTERNAL" | "PRIVATE";
  workspaceId: string;
};

type ProjectResponse = {
  default_branch: {
    name: string;
  };
  project: {
    key: string;
    name: string;
  };
  recommended_next_command: string;
};

export class ProjectCommand extends Command {
  static override description = "Manage projects.";

  static override args = {
    action: Args.string()
  };

  static override flags = {
    "api-url": Flags.string(),
    key: Flags.string(),
    name: Flags.string(),
    "session-cookie": Flags.string(),
    visibility: Flags.string(),
    "workspace-id": Flags.string()
  };

  override async run(): Promise<void> {
    const parsed = await this.parse(ProjectCommand);

    await runProject(parsed.flags, parsed.args.action, this.log.bind(this));
  }
}

export async function runProject(
  flags: ProjectCliFlags,
  action: string | undefined,
  writeLine: (message: string) => void
): Promise<void> {
  if (action === "create") {
    await createProject(flags, writeLine);
    return;
  }

  throw new Error("Missing project action.");
}

async function createProject(
  flags: ProjectCliFlags,
  writeLine: (message: string) => void
): Promise<void> {
  const projectFlags = projectFlagsFrom(flags);
  const response = await postJson(
    `${projectFlags.apiUrl}/v1/workspaces/${projectFlags.workspaceId}/projects`,
    {
      key: projectFlags.key,
      name: projectFlags.name,
      visibility: projectFlags.visibility
    },
    {
      Cookie: projectFlags.sessionCookie
    }
  );
  const body = response.body as ProjectResponse;

  writeLine(`Project ${body.project.name} ${body.project.key}`);
  writeLine(`Branch ${body.default_branch.name}`);
  writeLine(body.recommended_next_command);
}

function projectFlagsFrom(flags: ProjectCliFlags): ProjectFlags {
  return {
    apiUrl: requiredFlag(flags, "api-url"),
    key: requiredFlag(flags, "key"),
    name: requiredFlag(flags, "name"),
    sessionCookie: requiredFlag(flags, "session-cookie"),
    visibility: projectVisibility(flags.visibility ?? "PRIVATE"),
    workspaceId: requiredFlag(flags, "workspace-id")
  };
}

function projectVisibility(rawVisibility: string): "INTERNAL" | "PRIVATE" {
  const visibility = rawVisibility.toUpperCase();
  if (visibility === "INTERNAL" || visibility === "PRIVATE") {
    return visibility;
  }

  throw new Error("Visibility must be INTERNAL or PRIVATE.");
}
