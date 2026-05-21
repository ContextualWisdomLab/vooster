import { Command, Flags } from "@oclif/core";
import { CLIError } from "@oclif/core/errors";

import { buildAgentEnvelope } from "../agent-envelope.js";
import { configExists, localConfigPath, writeConfig } from "../config-store.js";

type InitCliFlags = {
  force?: boolean;
  format?: string;
  project?: string;
};

type InitFormat = "agent" | "human" | "json";

type InitData = {
  config_path: string;
  current_project_key: string;
};

export class InitCommand extends Command {
  static override description = "Initialize a .vspec directory in the current repository.";

  static override flags = {
    force: Flags.boolean(),
    format: Flags.string(),
    project: Flags.string()
  };

  override async run(): Promise<void> {
    const parsed = await this.parse(InitCommand);

    runInit(parsed.flags, process.cwd(), this.log.bind(this));
  }
}

export function runInit(
  flags: InitCliFlags,
  cwd: string,
  writeLine: (message: string) => void
): void {
  const projectKey = projectKeyFrom(flags.project);
  const path = localConfigPath(cwd);

  if (configExists({ path }) && flags.force !== true) {
    throw new CLIError(".vspec/config.json already exists. Re-run with --force to overwrite.", {
      exit: 6
    });
  }

  writeConfig(
    {
      current_project_key: projectKey
    },
    { merge: false, path }
  );

  const data: InitData = {
    config_path: path,
    current_project_key: projectKey
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
