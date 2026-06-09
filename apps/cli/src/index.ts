import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Args, Command, Flags, flush, handle } from "@oclif/core";
import { helpTextFor } from "./cli-help.js";
import { runActor } from "./commands/actor.js";
import { runAiGuide } from "./commands/ai-guide.js";
import { runApiKey } from "./commands/api-key.js";
import { runBranch } from "./commands/branch.js";
import { runChange } from "./commands/change.js";
import { runComment } from "./commands/comment.js";
import { runDiff } from "./commands/diff.js";
import { runDoctor } from "./commands/doctor.js";
import { runExport } from "./commands/export.js";
import { runGoal } from "./commands/goal.js";
import { runHistory } from "./commands/history.js";
import { runImpact } from "./commands/impact.js";
import { runInit } from "./commands/init.js";
import { runLogin } from "./commands/login.js";
import { runLogout } from "./commands/logout.js";
import { runLock } from "./commands/lock.js";
import { runMember } from "./commands/member.js";
import { runMerge } from "./commands/merge.js";
import { runProject } from "./commands/project.js";
import { runPull } from "./commands/pull.js";
import { runPush } from "./commands/push.js";
import { runRevert } from "./commands/revert.js";
import { runScenario } from "./commands/scenario.js";
import { runSession } from "./commands/session.js";
import { runStakeholder } from "./commands/stakeholder.js";
import { runStep } from "./commands/step.js";
import { runSync } from "./commands/sync.js";
import { runStatus } from "./commands/status.js";
import { runWorkspace } from "./commands/workspace.js";
import { runUsecase } from "./commands/usecase.js";
import { runVerify } from "./commands/verify.js";
import { runWho } from "./commands/who.js";

const root = dirname(fileURLToPath(import.meta.url));

type VspecFlags = {
  all?: boolean;
  "actor-id"?: string;
  "agent-type"?: string;
  "api-url"?: string;
  "auto-branch"?: boolean;
  "auto-commit"?: boolean;
  "base-revision"?: string;
  "branch-name"?: string;
  "dry-run"?: boolean;
  "entity-id"?: string;
  "preview-id"?: string;
  "project-id"?: string;
  "proposed-change"?: string;
  "session-cookie"?: string;
  "workspace-id"?: string;
  action?: string;
  actor?: string;
  aliases?: string;
  archived?: boolean;
  at?: string;
  body?: string;
  branch?: string;
  condition?: string;
  cursor?: string;
  description?: string;
  email?: string;
  field?: string;
  force?: boolean;
  format?: string;
  from?: string;
  human?: boolean;
  intent?: string;
  interest?: string;
  into?: string;
  key?: string;
  level?: string;
  limit?: string;
  name?: string;
  output?: string;
  outcome?: string;
  patch?: string;
  pin?: string;
  priority?: string;
  project?: string;
  q?: string;
  reason?: string;
  revision?: string;
  role?: string;
  root?: string;
  scopes?: string;
  session?: string;
  stakeholder?: string;
  status?: string;
  strategy?: string;
  summary?: string;
  title?: string;
  to?: string;
  ttl?: string;
  type?: string;
  "test-cmd"?: string;
  usecase?: string;
  value?: string;
  visibility?: string;
};

type CommandRouteContext = {
  argv: string[];
  cwd: string;
  flags: VspecFlags;
  writeLine: (message: string) => void;
};

type CommandRouteRunner = (context: CommandRouteContext) => Promise<void> | void;

const valueFlagNames = new Set([
  "actor-id",
  "agent-type",
  "api-url",
  "at",
  "base-revision",
  "body",
  "branch",
  "branch-name",
  "condition",
  "cursor",
  "description",
  "email",
  "entity-id",
  "field",
  "format",
  "from",
  "intent",
  "interest",
  "into",
  "key",
  "level",
  "limit",
  "name",
  "output",
  "outcome",
  "patch",
  "pin",
  "preview-id",
  "priority",
  "primary-actor",
  "project",
  "project-id",
  "proposed-change",
  "protection-mechanism",
  "q",
  "reason",
  "revision",
  "role",
  "root",
  "scopes",
  "session",
  "session-cookie",
  "stakeholder",
  "status",
  "strategy",
  "summary",
  "test-cmd",
  "title",
  "to",
  "ttl",
  "type",
  "usecase",
  "value",
  "visibility",
  "workspace-id",
  "workspace-name",
  "workspace-slug"
]);

const commandRoutes: Record<string, CommandRouteRunner> = {
  "actor archive": ({ argv, flags, writeLine }) =>
    runActor(flags, "archive", argv[2], writeLine),
  "actor create": ({ argv, flags, writeLine }) =>
    runActor(flags, "create", argv[2], writeLine),
  "actor edit": ({ argv, flags, writeLine }) =>
    runActor(flags, "edit", argv[2], writeLine),
  "actor list": ({ argv, flags, writeLine }) =>
    runActor(flags, "list", argv[2], writeLine),
  "actor show": ({ argv, flags, writeLine }) =>
    runActor(flags, "show", argv[2], writeLine),
  "ai-guide": ({ flags, writeLine }) => runAiGuide(flags, writeLine),
  "api-key create": ({ argv, flags, writeLine }) =>
    runApiKey(flags, "create", argv[2], writeLine),
  "api-key list": ({ argv, flags, writeLine }) =>
    runApiKey(flags, "list", argv[2], writeLine),
  "api-key revoke": ({ argv, flags, writeLine }) =>
    runApiKey(flags, "revoke", argv[2], writeLine),
  "branch create": ({ argv, flags, writeLine }) =>
    runBranch(flags, "create", argv[2], writeLine),
  "change commit": ({ flags, writeLine }) => runChange(flags, "commit", writeLine),
  "change propose": ({ flags, writeLine }) => runChange(flags, "propose", writeLine),
  "comment add": ({ argv, flags, writeLine }) =>
    runComment(flags, "add", argv[2], writeLine),
  "comment delete": ({ argv, flags, writeLine }) =>
    runComment(flags, "delete", argv[2], writeLine),
  "comment edit": ({ argv, flags, writeLine }) =>
    runComment(flags, "edit", argv[2], writeLine),
  "comment list": ({ argv, flags, writeLine }) =>
    runComment(flags, "list", argv[2], writeLine),
  "comment resolve": ({ argv, flags, writeLine }) =>
    runComment(flags, "resolve", argv[2], writeLine),
  diff: ({ argv, flags, writeLine }) =>
    runDiff(flags, argv[1], argv[2], argv[3], writeLine),
  doctor: ({ flags, writeLine }) => runDoctor(flags, writeLine),
  "export gherkin": ({ argv, flags, writeLine }) =>
    runExport(flags, "gherkin", argv[2], writeLine),
  "export markdown": ({ argv, flags, writeLine }) =>
    runExport(flags, "markdown", argv[2], writeLine),
  "goal create": ({ argv, flags, writeLine }) =>
    runGoal(flags, "create", argv[2], writeLine),
  "goal list": ({ argv, flags, writeLine }) =>
    runGoal(flags, "list", argv[2], writeLine),
  "goal promote": ({ argv, flags, writeLine }) =>
    runGoal(flags, "promote", argv[2], writeLine),
  "goal reject": ({ argv, flags, writeLine }) =>
    runGoal(flags, "reject", argv[2], writeLine),
  "goal show": ({ argv, flags, writeLine }) =>
    runGoal(flags, "show", argv[2], writeLine),
  history: ({ argv, flags, writeLine }) => runHistory(flags, argv[1], writeLine),
  impact: ({ argv, flags, writeLine }) => runImpact(flags, argv[1], writeLine),
  init: ({ cwd, flags, writeLine }) => runInit(flags, cwd, writeLine),
  "lock acquire": ({ argv, flags, writeLine }) =>
    runLock(flags, "acquire", argv[1], writeLine),
  "lock release": ({ argv, flags, writeLine }) =>
    runLock(flags, "release", argv[2], writeLine),
  "lock renew": ({ argv, flags, writeLine }) =>
    runLock(flags, "renew", argv[2], writeLine),
  login: ({ flags, writeLine }) => runLogin(flags, writeLine),
  logout: ({ flags, writeLine }) => runLogout(flags, writeLine),
  "member invite": ({ flags, writeLine }) => runMember(flags, "invite", writeLine),
  "merge open": ({ argv, flags, writeLine }) =>
    runMerge(flags, "open", argv[2], writeLine),
  "merge resolve": ({ argv, flags, writeLine }) =>
    runMerge(flags, "resolve", argv[2], writeLine),
  "project create": ({ flags, writeLine }) => runProject(flags, "create", writeLine),
  "project list": ({ flags, writeLine }) => runProject(flags, "list", writeLine),
  "project switch": ({ argv, flags, writeLine }) =>
    runProject(flags, "switch", writeLine, argv[2]),
  pull: ({ flags, writeLine }) => runPull(flags, writeLine),
  push: ({ flags, writeLine }) => runPush(flags, writeLine),
  revert: ({ argv, flags, writeLine }) => runRevert(flags, argv[1], writeLine),
  "scenario add": ({ argv, flags, writeLine }) =>
    runScenario(flags, "add", argv[2], writeLine),
  "session complete": ({ argv, flags, writeLine }) =>
    runSession(flags, "complete", argv[2], writeLine),
  "session list": ({ argv, flags, writeLine }) =>
    runSession(flags, "list", argv[2], writeLine),
  "session start": ({ argv, flags, writeLine }) =>
    runSession(flags, "start", argv[2], writeLine),
  "stakeholder archive": ({ argv, flags, writeLine }) =>
    runStakeholder(flags, "archive", argv[2], writeLine),
  "stakeholder create": ({ argv, flags, writeLine }) =>
    runStakeholder(flags, "create", argv[2], writeLine),
  "stakeholder edit": ({ argv, flags, writeLine }) =>
    runStakeholder(flags, "edit", argv[2], writeLine),
  "stakeholder list": ({ argv, flags, writeLine }) =>
    runStakeholder(flags, "list", argv[2], writeLine),
  "stakeholder show": ({ argv, flags, writeLine }) =>
    runStakeholder(flags, "show", argv[2], writeLine),
  status: ({ flags, writeLine }) => runStatus(flags, writeLine),
  "step add": ({ argv, flags, writeLine }) => runStep(flags, "add", argv[2], writeLine),
  "step edit": ({ argv, flags, writeLine }) =>
    runStep(flags, "edit", argv[2], writeLine),
  "step move": ({ argv, flags, writeLine }) =>
    runStep(flags, "move", argv[2], writeLine),
  sync: ({ flags, writeLine }) => runSync(flags, "sync", writeLine),
  "usecase add-stakeholder": ({ argv, flags, writeLine }) =>
    runUsecase(flags, "add-stakeholder", argv[2], writeLine),
  "usecase archive": ({ argv, flags, writeLine }) =>
    runUsecase(flags, "archive", argv[2], writeLine),
  "usecase create": ({ argv, flags, writeLine }) =>
    runUsecase(flags, "create", argv[2], writeLine),
  "usecase list": ({ argv, flags, writeLine }) =>
    runUsecase(flags, "list", argv[2], writeLine),
  "usecase restore": ({ argv, flags, writeLine }) =>
    runUsecase(flags, "restore", argv[2], writeLine),
  "usecase set": ({ argv, flags, writeLine }) =>
    runUsecase(flags, "set", firstRouteArgument(argv, 2), writeLine),
  "usecase show": ({ argv, flags, writeLine }) =>
    runUsecase(flags, "show", argv[2], writeLine),
  "usecase verify": ({ argv, flags, writeLine }) =>
    runUsecase(flags, "verify", argv[2], writeLine),
  verify: ({ argv, flags, writeLine }) => runVerify(flags, argv[1], writeLine),
  who: ({ argv, flags, writeLine }) => runWho(flags, argv[1], writeLine),
  "workspace switch": ({ argv, flags, writeLine }) => {
    runWorkspace(flags, "switch", argv[2], writeLine);
  }
};

export function commandRouteKeys(): string[] {
  return Object.keys(commandRoutes).sort();
}

export async function dispatchCommandRoute(
  context: CommandRouteContext
): Promise<boolean> {
  const routeKey = commandRouteKey(context.argv[0], context.argv);
  const route = routeKey === undefined ? undefined : commandRoutes[routeKey];
  if (route === undefined) {
    return false;
  }
  await route(context);
  return true;
}

function firstRouteArgument(
  argv: string[],
  firstCandidateIndex: number
): string | undefined {
  for (let index = firstCandidateIndex; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === undefined) {
      return undefined;
    }
    if (argument === "--") {
      return argv[index + 1];
    }
    if (argument.startsWith("--")) {
      const name = argument.slice(2).split("=", 1)[0] ?? "";
      if (!argument.includes("=") && valueFlagNames.has(name)) {
        index += 1;
      }
      continue;
    }
    if (argument.startsWith("-")) {
      continue;
    }
    return argument;
  }
  return undefined;
}

function commandRouteKey(
  command: string | undefined,
  argv: string[]
): string | undefined {
  if (command === undefined) {
    return undefined;
  }

  if (
    command === "lock" &&
    argv[1] !== undefined &&
    argv[1] !== "release" &&
    argv[1] !== "renew"
  ) {
    return "lock acquire";
  }

  const actionKey = `${command} ${argv[1] ?? ""}`.trim();
  if (commandRoutes[actionKey] !== undefined) {
    return actionKey;
  }

  return commandRoutes[command] !== undefined ? command : undefined;
}

export class VspecCommand extends Command {
  static override description =
    "Cockburn-style use case management for concurrent agents.";

  static override args = {
    command: Args.string()
  };

  static override flags = {
    "api-url": Flags.string(),
    all: Flags.boolean(),
    aliases: Flags.string(),
    action: Flags.string(),
    actor: Flags.string(),
    archived: Flags.boolean(),
    "actor-id": Flags.string(),
    at: Flags.string(),
    "base-revision": Flags.string(),
    "agent-type": Flags.string(),
    "auto-branch": Flags.boolean(),
    "auto-commit": Flags.boolean(),
    body: Flags.string(),
    branch: Flags.string(),
    "branch-name": Flags.string(),
    condition: Flags.string(),
    cursor: Flags.string(),
    description: Flags.string(),
    "dry-run": Flags.boolean(),
    email: Flags.string(),
    "entity-id": Flags.string(),
    field: Flags.string(),
    force: Flags.boolean(),
    format: Flags.string(),
    from: Flags.string(),
    human: Flags.boolean(),
    help: Flags.help({ char: "h" }),
    intent: Flags.string(),
    into: Flags.string(),
    interest: Flags.string(),
    key: Flags.string(),
    level: Flags.string(),
    limit: Flags.string(),
    name: Flags.string(),
    "no-merge": Flags.boolean(),
    output: Flags.string(),
    priority: Flags.string(),
    "primary-actor": Flags.string(),
    project: Flags.string(),
    "project-id": Flags.string(),
    "proposed-change": Flags.string(),
    "protection-mechanism": Flags.string(),
    outcome: Flags.string(),
    patch: Flags.string(),
    pin: Flags.string(),
    "preview-id": Flags.string(),
    q: Flags.string(),
    reason: Flags.string(),
    role: Flags.string(),
    root: Flags.string(),
    scopes: Flags.string(),
    session: Flags.string(),
    "session-cookie": Flags.string(),
    stakeholder: Flags.string(),
    status: Flags.string(),
    strategy: Flags.string(),
    summary: Flags.string(),
    "test-cmd": Flags.string(),
    title: Flags.string(),
    to: Flags.string(),
    ttl: Flags.string(),
    type: Flags.string(),
    value: Flags.string(),
    usecase: Flags.string(),
    version: Flags.version({ char: "v" }),
    visibility: Flags.string(),
    "workspace-id": Flags.string(),
    "workspace-name": Flags.string(),
    "workspace-slug": Flags.string()
  };

  static override strict = false;

  override async run(): Promise<void> {
    const parsed = await this.parse(VspecCommand);
    if (
      await dispatchCommandRoute({
        argv: this.argv,
        cwd: process.cwd(),
        flags: parsed.flags,
        writeLine: this.log.bind(this)
      })
    ) {
      return;
    }

    this.log("vspec CLI");
  }
}

export async function runCli(argv = process.argv.slice(2)): Promise<void> {
  try {
    const helpText = helpTextFor(argv);
    if (helpText !== undefined) {
      process.stdout.write(helpText);
      await flush();
      return;
    }
    await VspecCommand.run(argv, {
      pjson: {
        name: "vspec",
        oclif: {
          commands: {
            strategy: "single",
            target: "index.js"
          }
        },
        version: "1.0.0"
      },
      root
    });
    await flush();
  } catch (error: unknown) {
    const nonexistentFlag = nonexistentFlagMessage(error);
    if (nonexistentFlag !== undefined) {
      process.stderr.write(`Error: ${nonexistentFlag}\n`);
      process.exitCode = 1;
      await flush();
      return;
    }
    await handle(error instanceof Error ? error : new Error(String(error)));
  }
}

function nonexistentFlagMessage(error: unknown): string | undefined {
  if (!(error instanceof Error)) {
    return undefined;
  }
  const firstLine = error.message.split("\n", 1)[0];
  return firstLine?.startsWith("Nonexistent flag:") ? firstLine : undefined;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  void runCli();
}
