import { readFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Args, Command, Flags, flush, handle } from "@oclif/core";
import { runActor } from "./commands/actor.js";
import { runAiGuide } from "./commands/ai-guide.js";
import { runApiKey } from "./commands/api-key.js";
import { runBranch } from "./commands/branch.js";
import { runChange } from "./commands/change.js";
import { runComment } from "./commands/comment.js";
import { runDiff } from "./commands/diff.js";
import { runExport } from "./commands/export.js";
import { runGoal } from "./commands/goal.js";
import { runHistory } from "./commands/history.js";
import { runLogin } from "./commands/login.js";
import { runLock } from "./commands/lock.js";
import { runMember } from "./commands/member.js";
import { runMerge } from "./commands/merge.js";
import { runProject } from "./commands/project.js";
import { runPull } from "./commands/pull.js";
import { runPush } from "./commands/push.js";
import { runScenario } from "./commands/scenario.js";
import { runSession } from "./commands/session.js";
import { runStakeholder } from "./commands/stakeholder.js";
import { runStep } from "./commands/step.js";
import { runSync } from "./commands/sync.js";
import { runUsecase } from "./commands/usecase.js";
import { fetchJson, postJson } from "./http-client.js";

const root = dirname(fileURLToPath(import.meta.url));
export class VspecCommand extends Command {
  static override description = "Cockburn-style use case management for concurrent agents.";

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
    "github-code": Flags.string(),
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
    if (parsed.args.command === "ai-guide") {
      await runAiGuide(parsed.flags, this.log.bind(this));
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
    if (parsed.args.command === "lock" && this.argv[1] !== "renew") {
      await runLock(parsed.flags, this.argv[1], this.log.bind(this));
      return;
    }
    if (parsed.args.command === "who") {
      await this.showWho(parsed.flags);
      return;
    }
    if (parsed.args.command === "history") {
      await runHistory(parsed.flags, this.argv[1], this.log.bind(this));
      return;
    }
    if (parsed.args.command === "diff") {
      await runDiff(parsed.flags, this.argv[1], this.argv[2], this.argv[3], this.log.bind(this));
      return;
    }
    if (parsed.args.command === "revert") {
      await this.revertRevision(parsed.flags);
      return;
    }
    if (parsed.args.command === "impact") {
      await this.previewImpact(parsed.flags);
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
      await runActor(parsed.flags, this.argv[1], this.log.bind(this));
      return;
    }
    if (parsed.args.command === "stakeholder" && this.argv[1] === "create") {
      await runStakeholder(parsed.flags, this.argv[1], this.log.bind(this));
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

  private async showWho(flags: ParsedFlags): Promise<void> {
    const whoFlags = whoFlagsFrom(flags, this.argv[1]);
    const response = await fetchJson(`${whoFlags.apiUrl}/v1/usecases/${whoFlags.usecaseId}/who`, {
      headers: {
        Cookie: whoFlags.sessionCookie
      }
    });
    const body = response.body as WhoResponse;

    this.log(`UseCase ${body.usecase.key}`);
    this.log(`Sessions ${String(body.sessions.length)}`);
    for (const session of body.sessions) {
      this.log(`Session ${session.id}`);
      this.log(`Agent ${session.agent_type}`);
      this.log(`Intent ${session.intent}`);
      if ((session.markers ?? []).length > 0) {
        this.log(`Markers ${(session.markers ?? []).join(", ")}`);
      }
    }
    this.log(`Locks ${String(body.locks.length)}`);
    for (const lock of body.locks) {
      this.log(`Lock ${lock.id}`);
      this.log(`Type ${lock.lock_type}`);
      this.log(`Holder ${lock.held_by_session_id ?? lock.held_by_user_id}`);
      this.log(`Expires at ${lock.expires_at}`);
    }
    this.log(`Merge requests ${String(body.merge_requests.length)}`);
    for (const merge of body.merge_requests) {
      this.log(`Merge request ${merge.id}`);
      this.log(`Source branch ${merge.source_branch_id}`);
      this.log(`Status ${merge.status}`);
      this.log(`Conflicts ${String(merge.conflict_count)}`);
    }
    for (const action of body.suggested_next_actions) {
      this.log(action.command);
    }
  }

  private async revertRevision(flags: ParsedFlags): Promise<void> {
    const revertFlags = revertFlagsFrom(flags, this.argv[1]);
    const response = await postJson(
      `${revertFlags.apiUrl}/v1/usecases/${revertFlags.usecaseId}/revert`,
      {
        force: revertFlags.force,
        revision_id: revertFlags.revisionId,
        ...(revertFlags.summary === undefined ? {} : { summary: revertFlags.summary })
      },
      {
        Cookie: revertFlags.sessionCookie
      }
    );
    const body = response.body as RevertResponse;

    this.log(`UseCase ${body.usecase.id}`);
    this.log(`Title ${body.usecase.title}`);
    this.log(`Current revision ${body.usecase.current_revision_id}`);
    this.log(`Revision ${body.revision.id}`);
    this.log(`Parent ${body.revision.parent_revision_id}`);
    this.log(`Change ${body.revision.change_summary}`);
    this.log(`Version ${String(body.revision.version_number)}`);
    this.log(`Severity ${body.revision.severity}`);
    this.log(`Impact ${body.impact.severity}`);
    this.log(`Affected sessions ${body.impact.affected_sessions.join(", ") || "none"}`);
    this.log(`Affected branches ${body.impact.affected_branches.join(", ") || "none"}`);
    for (const warning of body.warnings ?? []) {
      this.log(`Warning ${warning.type} ${warning.message}`);
    }
    for (const action of body.suggested_next_actions) {
      this.log(action.command);
    }
  }

  private async previewImpact(flags: ParsedFlags): Promise<void> {
    const impactFlags = impactFlagsFrom(flags, this.argv[1]);
    const history = await latestUseCaseRevision(impactFlags);
    const proposedChange = await proposedChangePayload(impactFlags.proposedChangePath);
    const response = await postJson(
      `${impactFlags.apiUrl}/v1/changes/preview`,
      {
        base_revision: history.revision,
        entity_id: impactFlags.usecaseId,
        entity_type: "USECASE",
        ...proposedChange
      },
      {
        Cookie: impactFlags.sessionCookie
      }
    );
    const body = response.body as ImpactResponse;

    this.log(`Preview ${body.preview_id}`);
    this.log(`Cached ${String(body.cached)}`);
    this.log(`Severity ${body.impact.severity}`);
    this.log(`Confidence ${String(body.impact.confidence)}`);
    this.log(`Affected sessions ${formatAffectedSessions(body.impact.affected_sessions)}`);
    this.log(`Affected branches ${body.impact.affected_branches.join(", ") || "none"}`);
    this.log(`Affected tests ${body.impact.affected_tests.join(", ") || "none"}`);
    this.log(`Input hash ${body.impact.input_hash}`);
    for (const action of body.suggested_next_actions) {
      this.log(action.command);
    }
  }

}

type WhoFlags = {
  apiUrl: string;
  sessionCookie: string;
  usecaseId: string;
};

type RevertFlags = {
  apiUrl: string;
  force: boolean;
  revisionId: string;
  sessionCookie: string;
  summary: string | undefined;
  usecaseId: string;
};

type ImpactFlags = {
  apiUrl: string;
  proposedChangePath: string | undefined;
  sessionCookie: string;
  usecaseId: string;
};

type ParsedFlags = {
  "api-url"?: string;
  "agent-type"?: string;
  "auto-branch"?: boolean;
  "auto-commit"?: boolean;
  action?: string;
  actor?: string;
  aliases?: string;
  "actor-id"?: string;
  at?: string;
  "base-revision"?: string;
  body?: string;
  branch?: string;
  "branch-name"?: string;
  condition?: string;
  cursor?: string;
  description?: string;
  "dry-run"?: boolean;
  email?: string;
  "entity-id"?: string;
  field?: string;
  force?: boolean;
  format?: string;
  from?: string;
  "github-code"?: string;
  intent?: string;
  into?: string;
  interest?: string;
  key?: string;
  level?: string;
  limit?: string;
  name?: string;
  "no-merge"?: boolean;
  output?: string;
  priority?: string;
  "primary-actor"?: string;
  "project-id"?: string;
  "proposed-change"?: string;
  "protection-mechanism"?: string;
  outcome?: string;
  patch?: string;
  pin?: string;
  "preview-id"?: string;
  q?: string;
  reason?: string;
  revision?: string;
  role?: string;
  root?: string;
  scopes?: string;
  session?: string;
  "session-cookie"?: string;
  stakeholder?: string;
  status?: string;
  strategy?: string;
  summary?: string;
  title?: string;
  to?: string;
  ttl?: string;
  type?: string;
  usecase?: string;
  value?: string;
  visibility?: string;
  "workspace-id"?: string;
  "workspace-name"?: string;
  "workspace-slug"?: string;
};

type WhoResponse = {
  locks: Array<{
    expires_at: string;
    held_by_session_id: null | string;
    held_by_user_id: string;
    id: string;
    lock_type: string;
  }>;
  merge_requests: Array<{
    conflict_count: number;
    id: string;
    source_branch_id: string;
    status: string;
  }>;
  sessions: Array<{
    agent_type: string;
    id: string;
    intent: string;
    markers?: string[];
  }>;
  suggested_next_actions: Array<{
    command: string;
  }>;
  usecase: {
    key: string;
  };
};

type RevertResponse = {
  impact: {
    affected_branches: string[];
    affected_sessions: string[];
    severity: string;
  };
  revision: {
    change_summary: string;
    id: string;
    parent_revision_id: string;
    severity: string;
    version_number: number;
  };
  suggested_next_actions: Array<{
    command: string;
  }>;
  usecase: {
    current_revision_id: string;
    id: string;
    title: string;
  };
  warnings?: Array<{
    message: string;
    type: string;
  }>;
};

type ImpactResponse = {
  cached: boolean;
  impact: {
    affected_branches: string[];
    affected_sessions: Array<{
      agent_type: string;
      id: string;
      owner: string;
      pinned_revision: string;
    }>;
    affected_tests: string[];
    confidence: number;
    input_hash: string;
    severity: string;
  };
  preview_id: string;
  suggested_next_actions: Array<{
    command: string;
  }>;
};

type RevisionListResponse = {
  revisions: Array<{
    revision: string;
  }>;
};

function whoFlagsFrom(flags: ParsedFlags, usecaseId: string | undefined): WhoFlags {
  return {
    apiUrl: requiredFlag(flags, "api-url"),
    sessionCookie: requiredFlag(flags, "session-cookie"),
    usecaseId: requiredArgument(usecaseId, "usecase-id")
  };
}

function revertFlagsFrom(flags: ParsedFlags, usecaseId: string | undefined): RevertFlags {
  return {
    apiUrl: requiredFlag(flags, "api-url"),
    force: flags.force ?? false,
    revisionId: requiredFlag(flags, "to"),
    sessionCookie: requiredFlag(flags, "session-cookie"),
    summary: optionalFlag(flags, "summary"),
    usecaseId: requiredArgument(usecaseId, "usecase-id")
  };
}

function impactFlagsFrom(flags: ParsedFlags, usecaseId: string | undefined): ImpactFlags {
  return {
    apiUrl: requiredFlag(flags, "api-url"),
    proposedChangePath: optionalFlag(flags, "proposed-change"),
    sessionCookie: requiredFlag(flags, "session-cookie"),
    usecaseId: requiredArgument(usecaseId, "usecase-id")
  };
}

function optionalFlag(values: ParsedFlags, name: keyof ParsedFlags): string | undefined {
  const value = values[name];
  if (typeof value !== "string" || value.trim() === "") {
    return undefined;
  }

  return value;
}

function requiredFlag(values: ParsedFlags, name: keyof ParsedFlags): string {
  const value = values[name];
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Missing --${name}.`);
  }

  return value;
}

function requiredArgument(value: string | undefined, name: string): string {
  if (value === undefined || value.trim() === "") {
    throw new Error(`Missing ${name}.`);
  }

  return value;
}

async function latestUseCaseRevision(
  flags: Pick<ImpactFlags, "apiUrl" | "sessionCookie" | "usecaseId">
): Promise<{ revision: string }> {
  const url = new URL(`/v1/usecases/${flags.usecaseId}/revisions`, flags.apiUrl);
  url.searchParams.set("limit", "1");
  const response = await fetchJson(url, {
    headers: {
      Cookie: flags.sessionCookie
    }
  });
  const body = response.body as RevisionListResponse;
  const latest = body.revisions[0];
  if (latest === undefined) {
    throw new Error("Use case has no revisions.");
  }

  return { revision: latest.revision };
}

async function proposedChangePayload(path: string | undefined): Promise<Record<string, string>> {
  if (path === undefined) {
    return {};
  }

  return {
    proposed_change_content: await readFile(path, "utf8"),
    proposed_change_path: path
  };
}

function formatAffectedSessions(sessions: ImpactResponse["impact"]["affected_sessions"]): string {
  if (sessions.length === 0) {
    return "none";
  }

  return sessions
    .map((session) =>
      `${session.id} ${session.agent_type} ${session.owner} ${session.pinned_revision}`
    )
    .join(", ");
}

export async function runCli(argv = process.argv.slice(2)): Promise<void> {
  try {
    if (argv.includes("--help") || argv.includes("-h")) {
      await VspecCommand.run(["--help"], {
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
