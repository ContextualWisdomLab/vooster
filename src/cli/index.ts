import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Args, Command, Flags, flush, handle } from "@oclif/core";

const root = dirname(fileURLToPath(import.meta.url));

export class VspecCommand extends Command {
  static override description = "Cockburn-style use case management for concurrent agents.";

  static override args = {
    command: Args.string()
  };

  static override flags = {
    "api-url": Flags.string(),
    aliases: Flags.string(),
    "actor-id": Flags.string(),
    description: Flags.string(),
    email: Flags.string(),
    "github-code": Flags.string(),
    help: Flags.help({ char: "h" }),
    key: Flags.string(),
    level: Flags.string(),
    name: Flags.string(),
    priority: Flags.string(),
    "primary-actor": Flags.string(),
    "project-id": Flags.string(),
    role: Flags.string(),
    "session-cookie": Flags.string(),
    title: Flags.string(),
    type: Flags.string(),
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
      await this.login(parsed.flags);
      return;
    }
    if (parsed.args.command === "member" && this.argv[1] === "invite") {
      await this.inviteMember(parsed.flags);
      return;
    }
    if (parsed.args.command === "project" && this.argv[1] === "create") {
      await this.createProject(parsed.flags);
      return;
    }
    if (parsed.args.command === "actor" && this.argv[1] === "create") {
      await this.createActor(parsed.flags);
      return;
    }
    if (parsed.args.command === "stakeholder" && this.argv[1] === "create") {
      await this.createStakeholder(parsed.flags);
      return;
    }
    if (parsed.args.command === "goal" && this.argv[1] === "create") {
      await this.createGoal(parsed.flags);
      return;
    }
    if (parsed.args.command === "goal" && this.argv[1] === "list") {
      await this.listGoals(parsed.flags);
      return;
    }
    if (parsed.args.command === "goal" && this.argv[1] === "promote") {
      await this.promoteGoal(parsed.flags);
      return;
    }
    if (parsed.args.command === "usecase" && this.argv[1] === "create") {
      await this.createUseCase(parsed.flags);
      return;
    }

    this.log("vspec CLI");
  }

  private async login(flags: ParsedFlags): Promise<void> {
    const oauthFlags = oauthFlagsFrom(flags);
    const signupFlags = signupFlagsFrom(flags);
    const start = await postJson(
      `${oauthFlags.apiUrl}/v1/auth/github/start`,
      signupFlags === undefined
        ? { flow: "login" }
        : {
            workspace: {
              name: signupFlags.workspaceName,
              slug: signupFlags.workspaceSlug
            }
          }
    );
    const startBody = start.body as OAuthStartResponse;
    const callbackUrl = new URL("/v1/auth/github/callback", oauthFlags.apiUrl);
    callbackUrl.searchParams.set("code", oauthFlags.githubCode);
    callbackUrl.searchParams.set("state", startBody.state);

    const callback = await fetchJson(callbackUrl, {
      headers: {
        Cookie: start.cookie
      }
    });
    if (signupFlags === undefined) {
      this.printLogin(callback.body as LoginResponse);
      return;
    }

    this.printSignup(callback.body as SignupResponse);
  }

  private printSignup(callbackBody: SignupResponse): void {
    this.log(`Signed up ${callbackBody.user.email}`);
    this.log(`Workspace ${callbackBody.workspace.slug}`);
    this.log(callbackBody.recommended_next_command);
  }

  private printLogin(callbackBody: LoginResponse): void {
    this.log(`Logged in ${callbackBody.user.github_id}`);
    for (const workspace of callbackBody.workspaces) {
      this.log(`Workspace ${workspace.slug} ${workspace.role}`);
    }
    if (callbackBody.recommended_next_command !== undefined) {
      this.log(callbackBody.recommended_next_command);
    }
  }

  private async inviteMember(flags: ParsedFlags): Promise<void> {
    const inviteFlags = inviteFlagsFrom(flags);
    const response = await postJson(
      `${inviteFlags.apiUrl}/v1/workspaces/${inviteFlags.workspaceId}/invitations`,
      {
        email: inviteFlags.email,
        role: inviteFlags.role
      },
      {
        Cookie: inviteFlags.sessionCookie
      }
    );
    const body = response.body as InvitationResponse;

    this.log(`Invited ${body.invitation.email}`);
    this.log(`Role ${body.invitation.role}`);
    for (const action of body.suggested_next_actions) {
      this.log(action.command);
    }
  }

  private async createProject(flags: ParsedFlags): Promise<void> {
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

    this.log(`Project ${body.project.name} ${body.project.key}`);
    this.log(`Branch ${body.default_branch.name}`);
    this.log(body.recommended_next_command);
  }

  private async createActor(flags: ParsedFlags): Promise<void> {
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

    this.log(`Actor ${body.actor.name} ${body.actor.type}`);
    this.log(`Revision version ${String(body.revision.version_number)}`);
    this.log(body.recommended_next_command);
  }

  private async createStakeholder(flags: ParsedFlags): Promise<void> {
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

    this.log(`Stakeholder ${body.stakeholder.name} ${body.stakeholder.type}`);
    this.log(`Revision version ${String(body.revision.version_number)}`);
    this.log(body.recommended_next_command);
  }

  private async createGoal(flags: ParsedFlags): Promise<void> {
    const goalFlags = goalCreateFlagsFrom(flags);
    const response = await postJson(
      `${goalFlags.apiUrl}/v1/projects/${goalFlags.projectId}/goals`,
      {
        actor_id: goalFlags.actorId,
        description: goalFlags.description,
        level: goalFlags.level,
        priority: goalFlags.priority
      },
      {
        Cookie: goalFlags.sessionCookie
      }
    );
    const body = response.body as GoalResponse;

    this.log(`Goal ${body.goal.description}`);
    this.log(`Status ${body.goal.status} ${body.goal.priority}`);
    this.log(`Revision version ${String(body.revision.version_number)}`);
    for (const warning of body.warnings ?? []) {
      this.log(`Warning ${warning.command}`);
    }
    this.log(body.recommended_next_command);
  }

  private async listGoals(flags: ParsedFlags): Promise<void> {
    const goalFlags = goalListFlagsFrom(flags);
    const url = new URL(`/v1/projects/${goalFlags.projectId}/goals`, goalFlags.apiUrl);
    if (goalFlags.actorId !== undefined) {
      url.searchParams.set("actor_id", goalFlags.actorId);
    }

    const response = await fetchJson(url, {
      headers: {
        Cookie: goalFlags.sessionCookie
      }
    });
    const body = response.body as GoalListResponse;

    for (const actorGoals of body.actors) {
      this.log(`Actor ${actorGoals.actor.name}`);
      for (const goal of actorGoals.goals) {
        this.log(`${goal.description} ${goal.priority} ${goal.status}`);
      }
    }
  }

  private async promoteGoal(flags: ParsedFlags): Promise<void> {
    const goalFlags = goalPromoteFlagsFrom(flags, this.argv[2]);
    const response = await postJson(
      `${goalFlags.apiUrl}/v1/goals/${goalFlags.goalId}/promote`,
      {},
      {
        Cookie: goalFlags.sessionCookie
      }
    );
    const body = response.body as GoalPromotionResponse;

    this.log(`UseCase ${body.usecase.key}`);
    this.log(`Title ${body.usecase.title}`);
    this.log(`Format ${body.usecase.format}`);
    this.log(`Revision version ${String(body.revision.version_number)}`);
    this.log(`Goal ${body.goal.status}`);
    for (const warning of body.warnings ?? []) {
      this.log(`Warning ${warning.message}`);
    }
    for (const action of body.suggested_next_actions) {
      this.log(action.command);
    }
  }

  private async createUseCase(flags: ParsedFlags): Promise<void> {
    const useCaseFlags = useCaseCreateFlagsFrom(flags);
    const response = await postJson(
      `${useCaseFlags.apiUrl}/v1/projects/${useCaseFlags.projectId}/usecases`,
      {
        primary_actor: useCaseFlags.primaryActor,
        title: useCaseFlags.title
      },
      {
        Cookie: useCaseFlags.sessionCookie
      }
    );
    const body = response.body as UseCaseResponse;

    this.log(`UseCase ${body.usecase.key}`);
    this.log(`Title ${body.usecase.title}`);
    this.log(`Level ${body.usecase.level}`);
    this.log(`Format ${body.usecase.format}`);
    this.log(`Status ${body.usecase.status}`);
    this.log(`Priority ${body.usecase.priority}`);
    this.log(`Revision version ${String(body.revision.version_number)}`);
    for (const action of body.suggested_next_actions) {
      this.log(action.command);
    }
  }
}

type OAuthFlags = {
  apiUrl: string;
  githubCode: string;
};

type SignupFlags = {
  workspaceName: string;
  workspaceSlug: string;
};

type InviteFlags = {
  apiUrl: string;
  email: string;
  role: "EDITOR" | "OWNER";
  sessionCookie: string;
  workspaceId: string;
};

type ProjectFlags = {
  apiUrl: string;
  key: string;
  name: string;
  sessionCookie: string;
  visibility: "INTERNAL" | "PRIVATE";
  workspaceId: string;
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

type StakeholderFlags = {
  apiUrl: string;
  description: string;
  name: string;
  projectId: string;
  sessionCookie: string;
  type: "EXTERNAL" | "INTERNAL" | "REGULATORY";
};

type GoalCreateFlags = {
  actorId: string;
  apiUrl: string;
  description: string;
  level: "SUMMARY" | "USER_GOAL" | "SUBFUNCTION";
  priority: "P0" | "P1" | "P2" | "P3";
  projectId: string;
  sessionCookie: string;
};

type GoalListFlags = {
  actorId: string | undefined;
  apiUrl: string;
  projectId: string;
  sessionCookie: string;
};

type GoalPromoteFlags = {
  apiUrl: string;
  goalId: string;
  sessionCookie: string;
};

type UseCaseCreateFlags = {
  apiUrl: string;
  primaryActor: string;
  projectId: string;
  sessionCookie: string;
  title: string;
};

type ParsedFlags = {
  "api-url"?: string;
  aliases?: string;
  "actor-id"?: string;
  description?: string;
  email?: string;
  "github-code"?: string;
  key?: string;
  level?: string;
  name?: string;
  priority?: string;
  "primary-actor"?: string;
  "project-id"?: string;
  role?: string;
  "session-cookie"?: string;
  title?: string;
  type?: string;
  visibility?: string;
  "workspace-id"?: string;
  "workspace-name"?: string;
  "workspace-slug"?: string;
};

type OAuthStartResponse = {
  state: string;
};

type SignupResponse = {
  recommended_next_command: string;
  user: {
    email: string;
  };
  workspace: {
    slug: string;
  };
};

type LoginResponse = {
  recommended_next_command?: string;
  user: {
    github_id: string;
  };
  workspaces: Array<{
    role: string;
    slug: string;
  }>;
};

type InvitationResponse = {
  invitation: {
    email: string;
    role: string;
  };
  suggested_next_actions: Array<{
    command: string;
  }>;
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

type ActorResponse = {
  actor: {
    name: string;
    type: string;
  };
  recommended_next_command: string;
  revision: {
    version_number: number;
  };
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

type GoalResponse = {
  goal: {
    description: string;
    priority: string;
    status: string;
  };
  recommended_next_command: string;
  revision: {
    version_number: number;
  };
  warnings?: Array<{
    command: string;
  }>;
};

type GoalListResponse = {
  actors: Array<{
    actor: {
      name: string;
    };
    goals: Array<{
      description: string;
      priority: string;
      status: string;
    }>;
  }>;
};

type GoalPromotionResponse = {
  goal: {
    status: string;
  };
  revision: {
    version_number: number;
  };
  suggested_next_actions: Array<{
    command: string;
  }>;
  usecase: {
    format: string;
    key: string;
    title: string;
  };
  warnings?: Array<{
    message: string;
  }>;
};

type UseCaseResponse = {
  revision: {
    version_number: number;
  };
  suggested_next_actions: Array<{
    command: string;
  }>;
  usecase: {
    format: string;
    key: string;
    level: string;
    priority: string;
    status: string;
    title: string;
  };
};

function oauthFlagsFrom(flags: ParsedFlags): OAuthFlags {
  return {
    apiUrl: requiredFlag(flags, "api-url"),
    githubCode: requiredFlag(flags, "github-code")
  };
}

function signupFlagsFrom(flags: ParsedFlags): SignupFlags | undefined {
  if (flags["workspace-name"] === undefined && flags["workspace-slug"] === undefined) {
    return undefined;
  }

  return {
    workspaceName: requiredFlag(flags, "workspace-name"),
    workspaceSlug: requiredFlag(flags, "workspace-slug")
  };
}

function inviteFlagsFrom(flags: ParsedFlags): InviteFlags {
  return {
    apiUrl: requiredFlag(flags, "api-url"),
    email: requiredFlag(flags, "email"),
    role: invitationRole(requiredFlag(flags, "role")),
    sessionCookie: requiredFlag(flags, "session-cookie"),
    workspaceId: requiredFlag(flags, "workspace-id")
  };
}

function projectFlagsFrom(flags: ParsedFlags): ProjectFlags {
  return {
    apiUrl: requiredFlag(flags, "api-url"),
    key: requiredFlag(flags, "key"),
    name: requiredFlag(flags, "name"),
    sessionCookie: requiredFlag(flags, "session-cookie"),
    visibility: projectVisibility(flags.visibility ?? "PRIVATE"),
    workspaceId: requiredFlag(flags, "workspace-id")
  };
}

function actorFlagsFrom(flags: ParsedFlags): ActorFlags {
  return {
    aliases: aliasesFrom(flags.aliases),
    apiUrl: requiredFlag(flags, "api-url"),
    description: flags.description ?? "",
    name: requiredFlag(flags, "name"),
    projectId: requiredFlag(flags, "project-id"),
    sessionCookie: requiredFlag(flags, "session-cookie"),
    type: actorType(requiredFlag(flags, "type"))
  };
}

function stakeholderFlagsFrom(flags: ParsedFlags): StakeholderFlags {
  return {
    apiUrl: requiredFlag(flags, "api-url"),
    description: flags.description ?? "",
    name: requiredFlag(flags, "name"),
    projectId: requiredFlag(flags, "project-id"),
    sessionCookie: requiredFlag(flags, "session-cookie"),
    type: stakeholderType(requiredFlag(flags, "type"))
  };
}

function goalCreateFlagsFrom(flags: ParsedFlags): GoalCreateFlags {
  return {
    actorId: requiredFlag(flags, "actor-id"),
    apiUrl: requiredFlag(flags, "api-url"),
    description: requiredFlag(flags, "description"),
    level: goalLevel(requiredFlag(flags, "level")),
    priority: goalPriority(requiredFlag(flags, "priority")),
    projectId: requiredFlag(flags, "project-id"),
    sessionCookie: requiredFlag(flags, "session-cookie")
  };
}

function goalListFlagsFrom(flags: ParsedFlags): GoalListFlags {
  return {
    actorId: optionalFlag(flags, "actor-id"),
    apiUrl: requiredFlag(flags, "api-url"),
    projectId: requiredFlag(flags, "project-id"),
    sessionCookie: requiredFlag(flags, "session-cookie")
  };
}

function goalPromoteFlagsFrom(
  flags: ParsedFlags,
  goalId: string | undefined
): GoalPromoteFlags {
  return {
    apiUrl: requiredFlag(flags, "api-url"),
    goalId: requiredArgument(goalId, "goal-id"),
    sessionCookie: requiredFlag(flags, "session-cookie")
  };
}

function useCaseCreateFlagsFrom(flags: ParsedFlags): UseCaseCreateFlags {
  return {
    apiUrl: requiredFlag(flags, "api-url"),
    primaryActor: requiredFlag(flags, "primary-actor"),
    projectId: requiredFlag(flags, "project-id"),
    sessionCookie: requiredFlag(flags, "session-cookie"),
    title: requiredFlag(flags, "title")
  };
}

function invitationRole(rawRole: string): "EDITOR" | "OWNER" {
  const role = rawRole.toUpperCase();
  if (role === "EDITOR" || role === "OWNER") {
    return role;
  }

  throw new Error("Role must be EDITOR or OWNER.");
}

function projectVisibility(rawVisibility: string): "INTERNAL" | "PRIVATE" {
  const visibility = rawVisibility.toUpperCase();
  if (visibility === "INTERNAL" || visibility === "PRIVATE") {
    return visibility;
  }

  throw new Error("Visibility must be INTERNAL or PRIVATE.");
}

function actorType(rawType: string): "OFFSTAGE" | "PRIMARY" | "SUPPORTING" {
  const type = rawType.toUpperCase();
  if (type === "OFFSTAGE" || type === "PRIMARY" || type === "SUPPORTING") {
    return type;
  }

  throw new Error("Actor type must be PRIMARY, SUPPORTING, or OFFSTAGE.");
}

function stakeholderType(rawType: string): "EXTERNAL" | "INTERNAL" | "REGULATORY" {
  const type = rawType.toUpperCase();
  if (type === "EXTERNAL" || type === "INTERNAL" || type === "REGULATORY") {
    return type;
  }

  throw new Error("Stakeholder type must be INTERNAL, EXTERNAL, or REGULATORY.");
}

function goalLevel(rawLevel: string): "SUMMARY" | "USER_GOAL" | "SUBFUNCTION" {
  const level = rawLevel.toUpperCase();
  if (level === "SUMMARY" || level === "USER_GOAL" || level === "SUBFUNCTION") {
    return level;
  }

  throw new Error("Goal level must be SUMMARY, USER_GOAL, or SUBFUNCTION.");
}

function goalPriority(rawPriority: string): "P0" | "P1" | "P2" | "P3" {
  const priority = rawPriority.toUpperCase();
  if (priority === "P0" || priority === "P1" || priority === "P2" || priority === "P3") {
    return priority;
  }

  throw new Error("Goal priority must be P0, P1, P2, or P3.");
}

function aliasesFrom(rawAliases: string | undefined): string[] {
  if (rawAliases === undefined || rawAliases.trim() === "") {
    return [];
  }

  return rawAliases.split(",").map((alias) => alias.trim()).filter(Boolean);
}

function optionalFlag(values: ParsedFlags, name: keyof ParsedFlags): string | undefined {
  const value = values[name];
  if (value === undefined || value.trim() === "") {
    return undefined;
  }

  return value;
}

function requiredFlag(values: ParsedFlags, name: keyof ParsedFlags): string {
  const value = values[name];
  if (value === undefined || value.trim() === "") {
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

type JsonResponse = {
  body: unknown;
  cookie: string;
};

async function postJson(
  url: string,
  body: unknown,
  headers: Record<string, string> = {}
): Promise<JsonResponse> {
  return fetchJson(url, {
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
      ...headers
    },
    method: "POST"
  });
}

async function fetchJson(
  url: URL | string,
  init: RequestInit
): Promise<JsonResponse> {
  const response = await fetch(url, init);
  const body: unknown = await response.json();
  if (!response.ok) {
    throw new Error(`API request failed with ${String(response.status)}.`);
  }

  return {
    body,
    cookie: response.headers.get("set-cookie") ?? ""
  };
}

export async function runCli(argv = process.argv.slice(2)): Promise<void> {
  try {
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
