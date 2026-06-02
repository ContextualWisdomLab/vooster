import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
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
  "verify-workflow"?: boolean;
};

type InitFormat = "agent" | "human" | "json";

type InitData = {
  api_url: string;
  config_path: string;
  current_project_id: string;
  current_project_key: string;
  current_workspace_id: string;
  verify_workflow_path?: string;
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
    }),
    "verify-workflow": Flags.boolean({
      description: "Generate .github/workflows/vspec-verify.yml."
    })
  };

  static override examples = [
    "<%= config.bin %> init --project ACME",
    "<%= config.bin %> init --project ACME --force",
    "<%= config.bin %> init --project ACME --verify-workflow",
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
  const configPath = localConfigPath(cwd);
  const verifyWorkflowPath =
    flags["verify-workflow"] === true ? localVerifyWorkflowPath(cwd) : undefined;

  if (configExists({ path: configPath }) && flags.force !== true) {
    throw new CLIError(
      ".vspec/config.json already exists. Re-run with --force to overwrite.",
      {
        exit: 6
      }
    );
  }
  if (
    verifyWorkflowPath !== undefined &&
    existsSync(verifyWorkflowPath) &&
    flags.force !== true
  ) {
    throw new CLIError(
      ".github/workflows/vspec-verify.yml already exists. Re-run with --force to overwrite.",
      { exit: 6 }
    );
  }

  const projectContext = await resolveProjectContext(projectKey, cwd);

  writeConfig(projectContext, { merge: false, path: configPath });
  if (verifyWorkflowPath !== undefined) {
    writeVerifyWorkflow(verifyWorkflowPath, projectKey);
  }

  const data: InitData = {
    api_url: projectContext.api_url,
    config_path: configPath,
    current_project_id: projectContext.current_project_id,
    current_project_key: projectContext.current_project_key,
    current_workspace_id: projectContext.current_workspace_id,
    verify_workflow_path: verifyWorkflowPath
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
  writeLine(`Config ${configPath}`);
  if (verifyWorkflowPath !== undefined) {
    writeLine(`Verify workflow ${verifyWorkflowPath}`);
  }
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

function localVerifyWorkflowPath(cwd: string): string {
  return join(cwd, ".github", "workflows", "vspec-verify.yml");
}

function writeVerifyWorkflow(path: string, projectKey: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, verifyWorkflowTemplate(projectKey));
}

function verifyWorkflowTemplate(projectKey: string): string {
  const usecaseKey = githubExpression(
    `vars.VSPEC_VERIFY_USECASE || '${projectKey}-001'`
  );
  const testCommand = githubExpression("vars.VSPEC_VERIFY_TEST_COMMAND || 'pnpm test'");
  return [
    "name: Vspec Verify",
    "",
    "on:",
    "  pull_request:",
    "    branches: [main]",
    "  workflow_dispatch:",
    "",
    "permissions:",
    "  contents: read",
    "  pull-requests: write",
    "",
    "jobs:",
    "  vspec-verify:",
    "    runs-on: ubuntu-latest",
    "    timeout-minutes: 10",
    "    steps:",
    "      - uses: actions/checkout@v4",
    "      - uses: pnpm/action-setup@v4",
    "        with:",
    "          version: 11.0.5",
    "      - uses: actions/setup-node@v4",
    "        with:",
    '          node-version: "22"',
    "          cache: pnpm",
    "      - run: pnpm install --frozen-lockfile",
    "      - name: Run Vooster verify",
    "        id: verify",
    "        uses: vibemafiaclub/vooster@main",
    "        with:",
    `          usecase-key: "${usecaseKey}"`,
    `          test-command: "${testCommand}"`,
    `          api-url: "${githubExpression("vars.VSPEC_API_URL")}"`,
    `          session-cookie: "${githubExpression("secrets.VSPEC_SESSION_COOKIE")}"`,
    "          unlinked-policy: fail",
    "      - name: Comment verify failure",
    "        if: ${{ github.event_name == 'pull_request' && failure() && steps.verify.outcome == 'failure' }}",
    "        uses: actions/github-script@v7",
    "        with:",
    "          script: |",
    '            const fs = require("node:fs");',
    '            const exitCode = "${{ steps.verify.outputs.exit_code }}";',
    '            const logPath = "${{ steps.verify.outputs.log_path }}";',
    '            const log = fs.existsSync(logPath) ? fs.readFileSync(logPath, "utf8").slice(-12000) : "(no verify log captured)";',
    '            const body = ["Vooster spec-code verification failed.", "", `Exit code: ${exitCode || "unknown"}`, "", "```text", log, "```"].join("\\n");',
    "            await github.rest.issues.createComment({",
    "              owner: context.repo.owner,",
    "              repo: context.repo.repo,",
    "              issue_number: context.issue.number,",
    "              body",
    "            });",
    ""
  ].join("\n");
}

function githubExpression(value: string): string {
  return "$" + "{{ " + value + " }}";
}
