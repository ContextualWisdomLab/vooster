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
import { runWho } from "./commands/who.js";

const root = dirname(fileURLToPath(import.meta.url));
export class VspecCommand extends Command {
  static override description =
    "Cockburn-style use case management for concurrent agents.";

  static override args = {
    command: Args.string()
  };

  static override flags = {
    "api-url": Flags.string(),
    aliases: Flags.string(),
    action: Flags.string(),
    actor: Flags.string(),
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

    if (parsed.args.command === "login") {
      await runLogin(parsed.flags, this.log.bind(this));
      return;
    }
    if (parsed.args.command === "logout") {
      await runLogout(parsed.flags, this.log.bind(this));
      return;
    }
    if (parsed.args.command === "status") {
      await runStatus(parsed.flags, this.log.bind(this));
      return;
    }
    if (parsed.args.command === "ai-guide") {
      await runAiGuide(parsed.flags, this.log.bind(this));
      return;
    }
    if (parsed.args.command === "doctor") {
      await runDoctor(parsed.flags, this.log.bind(this));
      return;
    }
    if (parsed.args.command === "init") {
      await runInit(parsed.flags, process.cwd(), this.log.bind(this));
      return;
    }
    if (parsed.args.command === "member" && this.argv[1] === "invite") {
      await runMember(parsed.flags, this.argv[1], this.log.bind(this));
      return;
    }
    if (parsed.args.command === "api-key" && this.argv[1] === "create") {
      await runApiKey(parsed.flags, this.argv[1], this.argv[2], this.log.bind(this));
      return;
    }
    if (parsed.args.command === "api-key" && this.argv[1] === "list") {
      await runApiKey(parsed.flags, this.argv[1], this.argv[2], this.log.bind(this));
      return;
    }
    if (parsed.args.command === "api-key" && this.argv[1] === "revoke") {
      await runApiKey(parsed.flags, this.argv[1], this.argv[2], this.log.bind(this));
      return;
    }
    if (parsed.args.command === "project" && this.argv[1] === "create") {
      await runProject(parsed.flags, this.argv[1], this.log.bind(this));
      return;
    }
    if (parsed.args.command === "project" && this.argv[1] === "list") {
      await runProject(parsed.flags, this.argv[1], this.log.bind(this));
      return;
    }
    if (parsed.args.command === "project" && this.argv[1] === "switch") {
      await runProject(parsed.flags, this.argv[1], this.log.bind(this), this.argv[2]);
      return;
    }
    if (parsed.args.command === "workspace" && this.argv[1] === "switch") {
      runWorkspace(parsed.flags, this.argv[1], this.argv[2], this.log.bind(this));
      return;
    }
    if (parsed.args.command === "branch" && this.argv[1] === "create") {
      await runBranch(parsed.flags, this.argv[1], this.argv[2], this.log.bind(this));
      return;
    }
    if (parsed.args.command === "merge" && this.argv[1] === "open") {
      await runMerge(parsed.flags, this.argv[1], this.argv[2], this.log.bind(this));
      return;
    }
    if (parsed.args.command === "merge" && this.argv[1] === "resolve") {
      await runMerge(parsed.flags, this.argv[1], this.argv[2], this.log.bind(this));
      return;
    }
    if (parsed.args.command === "lock" && this.argv[1] === "renew") {
      await runLock(parsed.flags, this.argv[1], this.argv[2], this.log.bind(this));
      return;
    }
    if (parsed.args.command === "lock" && this.argv[1] === "release") {
      await runLock(parsed.flags, this.argv[1], this.argv[2], this.log.bind(this));
      return;
    }
    if (
      parsed.args.command === "lock" &&
      this.argv[1] !== "renew" &&
      this.argv[1] !== "release"
    ) {
      await runLock(parsed.flags, "acquire", this.argv[1], this.log.bind(this));
      return;
    }
    if (parsed.args.command === "who") {
      await runWho(parsed.flags, this.argv[1], this.log.bind(this));
      return;
    }
    if (parsed.args.command === "history") {
      await runHistory(parsed.flags, this.argv[1], this.log.bind(this));
      return;
    }
    if (parsed.args.command === "diff") {
      await runDiff(
        parsed.flags,
        this.argv[1],
        this.argv[2],
        this.argv[3],
        this.log.bind(this)
      );
      return;
    }
    if (parsed.args.command === "revert") {
      await runRevert(parsed.flags, this.argv[1], this.log.bind(this));
      return;
    }
    if (parsed.args.command === "impact") {
      await runImpact(parsed.flags, this.argv[1], this.log.bind(this));
      return;
    }
    if (parsed.args.command === "change" && this.argv[1] === "propose") {
      await runChange(parsed.flags, this.argv[1], this.log.bind(this));
      return;
    }
    if (parsed.args.command === "change" && this.argv[1] === "commit") {
      await runChange(parsed.flags, this.argv[1], this.log.bind(this));
      return;
    }
    if (parsed.args.command === "pull") {
      await runPull(parsed.flags, this.log.bind(this));
      return;
    }
    if (parsed.args.command === "push") {
      await runPush(parsed.flags, this.log.bind(this));
      return;
    }
    if (parsed.args.command === "sync") {
      await runSync(parsed.flags, "sync", this.log.bind(this));
      return;
    }
    if (parsed.args.command === "export" && this.argv[1] === "gherkin") {
      await runExport(parsed.flags, this.argv[1], this.argv[2], this.log.bind(this));
      return;
    }
    if (parsed.args.command === "export" && this.argv[1] === "markdown") {
      await runExport(parsed.flags, this.argv[1], this.argv[2], this.log.bind(this));
      return;
    }
    if (parsed.args.command === "comment" && this.argv[1] === "add") {
      await runComment(parsed.flags, this.argv[1], this.argv[2], this.log.bind(this));
      return;
    }
    if (parsed.args.command === "comment" && this.argv[1] === "list") {
      await runComment(parsed.flags, this.argv[1], this.argv[2], this.log.bind(this));
      return;
    }
    if (parsed.args.command === "comment" && this.argv[1] === "edit") {
      await runComment(parsed.flags, this.argv[1], this.argv[2], this.log.bind(this));
      return;
    }
    if (parsed.args.command === "comment" && this.argv[1] === "resolve") {
      await runComment(parsed.flags, this.argv[1], this.argv[2], this.log.bind(this));
      return;
    }
    if (parsed.args.command === "comment" && this.argv[1] === "delete") {
      await runComment(parsed.flags, this.argv[1], this.argv[2], this.log.bind(this));
      return;
    }
    if (parsed.args.command === "actor" && this.argv[1] === "create") {
      await runActor(parsed.flags, this.argv[1], this.argv[2], this.log.bind(this));
      return;
    }
    if (parsed.args.command === "actor" && this.argv[1] === "list") {
      await runActor(parsed.flags, this.argv[1], this.argv[2], this.log.bind(this));
      return;
    }
    if (parsed.args.command === "actor" && this.argv[1] === "show") {
      await runActor(parsed.flags, this.argv[1], this.argv[2], this.log.bind(this));
      return;
    }
    if (parsed.args.command === "actor" && this.argv[1] === "edit") {
      await runActor(parsed.flags, this.argv[1], this.argv[2], this.log.bind(this));
      return;
    }
    if (parsed.args.command === "actor" && this.argv[1] === "archive") {
      await runActor(parsed.flags, this.argv[1], this.argv[2], this.log.bind(this));
      return;
    }
    if (parsed.args.command === "stakeholder" && this.argv[1] === "create") {
      await runStakeholder(
        parsed.flags,
        this.argv[1],
        this.argv[2],
        this.log.bind(this)
      );
      return;
    }
    if (parsed.args.command === "stakeholder" && this.argv[1] === "list") {
      await runStakeholder(
        parsed.flags,
        this.argv[1],
        this.argv[2],
        this.log.bind(this)
      );
      return;
    }
    if (parsed.args.command === "stakeholder" && this.argv[1] === "show") {
      await runStakeholder(
        parsed.flags,
        this.argv[1],
        this.argv[2],
        this.log.bind(this)
      );
      return;
    }
    if (parsed.args.command === "stakeholder" && this.argv[1] === "edit") {
      await runStakeholder(
        parsed.flags,
        this.argv[1],
        this.argv[2],
        this.log.bind(this)
      );
      return;
    }
    if (parsed.args.command === "stakeholder" && this.argv[1] === "archive") {
      await runStakeholder(
        parsed.flags,
        this.argv[1],
        this.argv[2],
        this.log.bind(this)
      );
      return;
    }
    if (parsed.args.command === "goal" && this.argv[1] === "create") {
      await runGoal(parsed.flags, this.argv[1], this.argv[2], this.log.bind(this));
      return;
    }
    if (parsed.args.command === "goal" && this.argv[1] === "list") {
      await runGoal(parsed.flags, this.argv[1], this.argv[2], this.log.bind(this));
      return;
    }
    if (parsed.args.command === "goal" && this.argv[1] === "promote") {
      await runGoal(parsed.flags, this.argv[1], this.argv[2], this.log.bind(this));
      return;
    }
    if (parsed.args.command === "goal" && this.argv[1] === "show") {
      await runGoal(parsed.flags, this.argv[1], this.argv[2], this.log.bind(this));
      return;
    }
    if (parsed.args.command === "goal" && this.argv[1] === "reject") {
      await runGoal(parsed.flags, this.argv[1], this.argv[2], this.log.bind(this));
      return;
    }
    if (parsed.args.command === "usecase" && this.argv[1] === "create") {
      await runUsecase(parsed.flags, this.argv[1], this.argv[2], this.log.bind(this));
      return;
    }
    if (parsed.args.command === "usecase" && this.argv[1] === "add-stakeholder") {
      await runUsecase(parsed.flags, this.argv[1], this.argv[2], this.log.bind(this));
      return;
    }
    if (parsed.args.command === "usecase" && this.argv[1] === "list") {
      await runUsecase(parsed.flags, this.argv[1], this.argv[2], this.log.bind(this));
      return;
    }
    if (parsed.args.command === "usecase" && this.argv[1] === "show") {
      await runUsecase(parsed.flags, this.argv[1], this.argv[2], this.log.bind(this));
      return;
    }
    if (parsed.args.command === "usecase" && this.argv[1] === "archive") {
      await runUsecase(parsed.flags, this.argv[1], this.argv[2], this.log.bind(this));
      return;
    }
    if (parsed.args.command === "usecase" && this.argv[1] === "set") {
      await runUsecase(parsed.flags, this.argv[1], this.argv[2], this.log.bind(this));
      return;
    }
    if (parsed.args.command === "usecase" && this.argv[1] === "restore") {
      await runUsecase(parsed.flags, this.argv[1], this.argv[2], this.log.bind(this));
      return;
    }
    if (parsed.args.command === "scenario" && this.argv[1] === "add") {
      await runScenario(parsed.flags, this.argv[1], this.argv[2], this.log.bind(this));
      return;
    }
    if (parsed.args.command === "step" && this.argv[1] === "add") {
      await runStep(parsed.flags, this.argv[1], this.argv[2], this.log.bind(this));
      return;
    }
    if (parsed.args.command === "step" && this.argv[1] === "edit") {
      await runStep(parsed.flags, this.argv[1], this.argv[2], this.log.bind(this));
      return;
    }
    if (parsed.args.command === "session" && this.argv[1] === "complete") {
      await runSession(parsed.flags, this.argv[1], this.argv[2], this.log.bind(this));
      return;
    }
    if (parsed.args.command === "session" && this.argv[1] === "list") {
      await runSession(parsed.flags, this.argv[1], this.argv[2], this.log.bind(this));
      return;
    }
    if (parsed.args.command === "session" && this.argv[1] === "start") {
      await runSession(parsed.flags, this.argv[1], this.argv[2], this.log.bind(this));
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
    await handle(error instanceof Error ? error : new Error(String(error)));
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  void runCli();
}
