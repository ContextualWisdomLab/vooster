import { Args, Command, Flags } from "@oclif/core";

import { buildAgentEnvelope } from "../agent-envelope.js";
import {
  commonMutationContextFrom,
  runMutationCommand
} from "../application/mutation-command.js";
import { writeConfig } from "../config-store.js";
import { requiredArgument, requiredFlag, resolveContextFlag } from "../flag-values.js";
import { fetchJson } from "../http-client.js";

type ProjectCliFlags = {
  "api-url"?: string;
  branch?: string;
  "dry-run"?: boolean;
  format?: string;
  key?: string;
  name?: string;
  root?: string;
  "session-cookie"?: string;
  visibility?: string;
  "workspace-id"?: string;
};

type ProjectFlags = {
  apiUrl: string;
  branch: string;
  dryRun: boolean;
  key: string;
  name: string;
  projectId: null;
  root: string;
  sessionCookie: string;
  visibility: "INTERNAL" | "PRIVATE";
  workspaceId: string;
};

type ProjectResponse = {
  default_branch: {
    name: string;
  };
  project: {
    id: string;
    key: string;
    name: string;
  };
  recommended_next_command: string;
};

type ProjectListResponse = {
  items: Array<{
    id: string;
    key: string;
    name: string;
  }>;
};

export class ProjectCommand extends Command {
  static override description = "Manage projects.";

  static override args = {
    action: Args.string()
  };

  static override flags = {
    "api-url": Flags.string(),
    branch: Flags.string(),
    "dry-run": Flags.boolean(),
    format: Flags.string(),
    key: Flags.string(),
    name: Flags.string(),
    root: Flags.string(),
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
  writeLine: (message: string) => void,
  projectKeyArg?: string
): Promise<void> {
  if (action === "create") {
    await createProject(flags, writeLine);
    return;
  }
  if (action === "list") {
    await listProjects(flags, writeLine);
    return;
  }
  if (action === "switch") {
    switchProject(flags, projectKeyArg, writeLine);
    return;
  }

  throw new Error("Missing project action.");
}

async function createProject(
  flags: ProjectCliFlags,
  writeLine: (message: string) => void
): Promise<void> {
  const projectFlags = projectFlagsFrom(flags);
  await runMutationCommand<ProjectResponse>(
    {
      body: {
        key: projectFlags.key,
        name: projectFlags.name,
        visibility: projectFlags.visibility
      },
      method: "POST",
      path: `/v1/workspaces/${projectFlags.workspaceId}/projects`,
      successHints: (data) => {
        if (!projectFlags.dryRun) {
          writeConfig({
            current_project_id: data.project.id,
            current_project_key: data.project.key
          });
        }
        return [{ command: data.recommended_next_command }];
      }
    },
    commonMutationContextFrom(projectFlags),
    {
      format: flags.format,
      human: (data, write) => {
        write(`Project ${data.project.name} ${data.project.key} ${data.project.id}`);
        write(`Branch ${data.default_branch.name}`);
        write(data.recommended_next_command);
      },
      writeLine
    }
  );
}

async function listProjects(
  flags: ProjectCliFlags,
  writeLine: (message: string) => void
): Promise<void> {
  const response = await fetchJson(
    `${resolveContextFlag(flags, "api-url")}/v1/projects`,
    {
      headers: {
        Cookie: resolveContextFlag(flags, "session-cookie")
      }
    }
  );
  const body = response.body as ProjectListResponse;

  if (flags.format === "agent") {
    writeLine(JSON.stringify(buildAgentEnvelope({ data: body }), null, 2));
    return;
  }

  for (const project of body.items) {
    writeLine(`${project.key} ${project.name} ${project.id}`);
  }
}

function switchProject(
  flags: ProjectCliFlags,
  projectKeyArg: string | undefined,
  writeLine: (message: string) => void
): void {
  const projectKey = requiredArgument(projectKeyArg, "project key");
  writeConfig({
    current_project_key: projectKey
  });

  if (flags.format === "agent") {
    writeLine(
      JSON.stringify(
        buildAgentEnvelope({
          data: {
            config: {
              current_project_key: projectKey
            },
            project: {
              key: projectKey
            }
          }
        }),
        null,
        2
      )
    );
    return;
  }

  writeLine(`Project ${projectKey}`);
}

function projectFlagsFrom(flags: ProjectCliFlags): ProjectFlags {
  return {
    apiUrl: resolveContextFlag(flags, "api-url"),
    branch: flags.branch ?? "main",
    dryRun: flags["dry-run"] === true,
    key: requiredFlag(flags, "key"),
    name: requiredFlag(flags, "name"),
    projectId: null,
    root: flags.root ?? process.cwd(),
    sessionCookie: resolveContextFlag(flags, "session-cookie"),
    visibility: projectVisibility(flags.visibility ?? "PRIVATE"),
    workspaceId: resolveContextFlag(flags, "workspace-id")
  };
}

function projectVisibility(rawVisibility: string): "INTERNAL" | "PRIVATE" {
  const visibility = rawVisibility.toUpperCase();
  if (visibility === "INTERNAL" || visibility === "PRIVATE") {
    return visibility;
  }

  throw new Error("Visibility must be INTERNAL or PRIVATE.");
}
