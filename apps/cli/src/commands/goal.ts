import { Args, Command, Flags } from "@oclif/core";

import {
  printGoalList,
  printGoalPromotion,
  printGoalResponse,
  type GoalListResponse,
  type GoalPromotionResponse,
  type GoalResponse
} from "./goal-output.js";
import { optionalFlag, requiredArgument, requiredFlag, resolveContextFlag } from "../flag-values.js";
import { fetchJson, postJson } from "../http-client.js";

type GoalCliFlags = {
  "actor-id"?: string;
  "api-url"?: string;
  description?: string;
  level?: string;
  priority?: string;
  "project-id"?: string;
  "session-cookie"?: string;
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

export class GoalCommand extends Command {
  static override description = "Manage project goals.";

  static override args = {
    action: Args.string(),
    goalId: Args.string()
  };

  static override flags = {
    "actor-id": Flags.string(),
    "api-url": Flags.string(),
    description: Flags.string(),
    level: Flags.string(),
    priority: Flags.string(),
    "project-id": Flags.string(),
    "session-cookie": Flags.string()
  };

  override async run(): Promise<void> {
    const parsed = await this.parse(GoalCommand);

    await runGoal(parsed.flags, parsed.args.action, parsed.args.goalId, this.log.bind(this));
  }
}

export async function runGoal(
  flags: GoalCliFlags,
  action: string | undefined,
  goalId: string | undefined,
  writeLine: (message: string) => void
): Promise<void> {
  if (action === "create") {
    await createGoal(flags, writeLine);
    return;
  }
  if (action === "list") {
    await listGoals(flags, writeLine);
    return;
  }
  if (action === "promote") {
    await promoteGoal(flags, goalId, writeLine);
    return;
  }

  throw new Error("Missing goal action.");
}

async function createGoal(flags: GoalCliFlags, writeLine: (message: string) => void): Promise<void> {
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

  printGoalResponse(body, writeLine);
}

async function listGoals(flags: GoalCliFlags, writeLine: (message: string) => void): Promise<void> {
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

  printGoalList(body, writeLine);
}

async function promoteGoal(
  flags: GoalCliFlags,
  goalId: string | undefined,
  writeLine: (message: string) => void
): Promise<void> {
  const goalFlags = goalPromoteFlagsFrom(flags, goalId);
  const response = await postJson(
    `${goalFlags.apiUrl}/v1/goals/${goalFlags.goalId}/promote`,
    {},
    {
      Cookie: goalFlags.sessionCookie
    }
  );
  const body = response.body as GoalPromotionResponse;

  printGoalPromotion(body, writeLine);
}

function goalCreateFlagsFrom(flags: GoalCliFlags): GoalCreateFlags {
  return {
    actorId: requiredFlag(flags, "actor-id"),
    apiUrl: resolveContextFlag(flags, "api-url"),
    description: requiredFlag(flags, "description"),
    level: goalLevel(requiredFlag(flags, "level")),
    priority: goalPriority(requiredFlag(flags, "priority")),
    projectId: requiredFlag(flags, "project-id"),
    sessionCookie: resolveContextFlag(flags, "session-cookie")
  };
}

function goalListFlagsFrom(flags: GoalCliFlags): GoalListFlags {
  return {
    actorId: optionalFlag(flags, "actor-id"),
    apiUrl: resolveContextFlag(flags, "api-url"),
    projectId: requiredFlag(flags, "project-id"),
    sessionCookie: resolveContextFlag(flags, "session-cookie")
  };
}

function goalPromoteFlagsFrom(
  flags: GoalCliFlags,
  goalId: string | undefined
): GoalPromoteFlags {
  return {
    apiUrl: resolveContextFlag(flags, "api-url"),
    goalId: requiredArgument(goalId, "goal-id"),
    sessionCookie: resolveContextFlag(flags, "session-cookie")
  };
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
