import { Command, Flags } from "@oclif/core";
import { CLIError } from "@oclif/core/errors";

import { buildAgentEnvelope } from "../agent-envelope.js";
import {
  configExists,
  localConfigPath,
  readConfig,
  writeConfig
} from "../config-store.js";
import { fetchJson } from "../http-client.js";

type InitCliFlags = {
  force?: boolean;
  format?: string;
  project?: string;
};

type InitFormat = "agent" | "human" | "json";

type InitData = {
  api_url: string;
  config_path: string;
  current_project_id: string;
  current_project_key: string;
  current_workspace_id: string;
};

type ProjectListResponse = {
  items: Array<{
    id: string;
    key: string;
    workspace_id: string;
  }>;
};

export class InitCommand extends Command {
  static override description =
    "Initialize a .vspec directory in the current repository.";

  static override flags = {
    force: Flags.boolean({ description: "Overwrite an existing .vspec/config.json." }),
    format: Flags.string({
      description: "Output format: human, json, or agent.",
      options: ["human", "json", "agent"]
    }),
    help: Flags.help({ char: "h" }),
    project: Flags.string({
      description: "Project key to bind this repo to.",
      required: false
    })
  };

  static override examples = [
    "<%= config.bin %> init --project ACME",
    "<%= config.bin %> init --project ACME --force",
    "<%= config.bin %> init --project ACME --format agent"
  ];

  override async run(): Promise<void> {
    const parsed = await this.parse(InitCommand);

    await runInit(parsed.flags, process.cwd(), this.log.bind(this));
  }
}

export async function runInit(
  flags: InitCliFlags,
  cwd: string,
  writeLine: (message: string) => void
): Promise<void> {
  const projectKey = projectKeyFrom(flags.project);
  const path = localConfigPath(cwd);

  if (configExists({ path }) && flags.force !== true) {
    throw new CLIError(
      ".vspec/config.json already exists. Re-run with --force to overwrite.",
      {
        exit: 6
      }
    );
  }

  const projectContext = await resolveProjectContext(projectKey, cwd);

  writeConfig(projectContext, { merge: false, path });

  const data: InitData = {
    api_url: projectContext.api_url,
    config_path: path,
    current_project_id: projectContext.current_project_id,
    current_project_key: projectContext.current_project_key,
    current_workspace_id: projectContext.current_workspace_id
  };
  const format = initFormat(flags.format ?? "human");

  if (format === "agent") {
    writeLine(JSON.stringify(buildAgentEnvelope({ data }), null, 2));
    return;
  }

  if (format === "json") {
    writeLine(JSON.stringify(data, null, 2));
    return;
  }

  writeLine(`Project ${projectKey}`);
  writeLine(`Config ${path}`);
}

async function resolveProjectContext(projectKey: string, cwd: string) {
  const config = readConfig({ cwd });
  if (config.api_url === undefined || config.session_token === undefined) {
    throw new CLIError("Run 'vspec login' before init.", { exit: 6 });
  }

  const response = await fetchJson(`${config.api_url}/v1/projects`, {
    headers: { Cookie: sessionCookie(config.session_token) }
  });
  const projects = projectListFrom(response.body);
  const project = projects.find((item) => item.key === projectKey);
  if (project === undefined) {
    throw new CLIError(`Project key '${projectKey}' was not found.`, { exit: 6 });
  }

  return {
    api_url: config.api_url,
    current_project_id: project.id,
    current_project_key: project.key,
    current_workspace_id: project.workspace_id
  };
}

function projectListFrom(body: unknown): ProjectListResponse["items"] {
  if (typeof body !== "object" || body === null || !("items" in body)) {
    return [];
  }

  const items = body.items;
  if (!Array.isArray(items)) {
    return [];
  }

  return items.filter(isProjectListItem);
}

function isProjectListItem(
  value: unknown
): value is ProjectListResponse["items"][number] {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    "key" in value &&
    "workspace_id" in value &&
    typeof value.id === "string" &&
    typeof value.key === "string" &&
    typeof value.workspace_id === "string"
  );
}

function sessionCookie(value: string): string {
  if (value.includes("vspec_session=")) {
    return value;
  }

  return `vspec_session=${value}`;
}

function projectKeyFrom(value: string | undefined): string {
  if (value === undefined || value.trim() === "") {
    throw new CLIError("Missing --project.", { exit: 2 });
  }

  return value;
}

function initFormat(rawFormat: string): InitFormat {
  const format = rawFormat.toLowerCase();
  if (isInitFormat(format)) {
    return format;
  }

  throw new CLIError("Init format must be human, json, or agent.", { exit: 2 });
}

function isInitFormat(format: string): format is InitFormat {
  return ["agent", "human", "json"].includes(format);
}
