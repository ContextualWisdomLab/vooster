import { optionalFlag, requiredArgument, requiredFlag, resolveContextFlag } from "../flag-values.js";

export type GoalCliFlags = {
  "actor-id"?: string;
  "api-url"?: string;
  branch?: string;
  description?: string;
  "dry-run"?: boolean;
  format?: string;
  level?: string;
  priority?: string;
  "project-id"?: string;
  root?: string;
  "session-cookie"?: string;
};

export type GoalCreateFlags = {
  actorId: string;
  apiUrl: string;
  branch: string;
  description: string;
  dryRun: boolean;
  level: "SUMMARY" | "USER_GOAL" | "SUBFUNCTION";
  priority: "P0" | "P1" | "P2" | "P3";
  projectId: string;
  root: string;
  sessionCookie: string;
};

export type GoalListFlags = {
  actorId: string | undefined;
  apiUrl: string;
  projectId: string;
  sessionCookie: string;
};

export type GoalIdFlags = {
  apiUrl: string;
  goalId: string;
  sessionCookie: string;
};

export function goalCreateFlagsFrom(flags: GoalCliFlags): GoalCreateFlags {
  return {
    actorId: requiredFlag(flags, "actor-id"),
    apiUrl: resolveContextFlag(flags, "api-url"),
    branch: flags.branch ?? "main",
    description: requiredFlag(flags, "description"),
    dryRun: flags["dry-run"] === true,
    level: goalLevel(requiredFlag(flags, "level")),
    priority: goalPriority(requiredFlag(flags, "priority")),
    projectId: requiredFlag(flags, "project-id"),
    root: flags.root ?? process.cwd(),
    sessionCookie: resolveContextFlag(flags, "session-cookie")
  };
}

export function goalListFlagsFrom(flags: GoalCliFlags): GoalListFlags {
  return {
    actorId: optionalFlag(flags, "actor-id"),
    apiUrl: resolveContextFlag(flags, "api-url"),
    projectId: requiredFlag(flags, "project-id"),
    sessionCookie: resolveContextFlag(flags, "session-cookie")
  };
}

export function goalIdFlagsFrom(
  flags: GoalCliFlags,
  goalId: string | undefined
): GoalIdFlags {
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
