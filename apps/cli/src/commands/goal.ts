import { Args, Command, Flags } from "@oclif/core";
import {
  goalCreateRequestSchema,
  goalCreateResponseSchema,
  goalListQuerySchema,
  goalListResponseSchema,
  goalPatchRequestSchema,
  goalPatchResponseSchema,
  goalPromotionResponseSchema,
  goalShowResponseSchema,
  type GoalCreateResponse
} from "@vooster/contracts";

import {
  goalCreateFlagsFrom,
  goalIdFlagsFrom,
  goalListFlagsFrom,
  type GoalCliFlags
} from "./goal-flags.js";
import { printGoalList, printGoalPromotion, printGoalResponse } from "./goal-output.js";
import { buildAgentEnvelope } from "../agent-envelope.js";
import {
  commonMutationContextFrom,
  runMutationCommand
} from "../application/mutation-command.js";
import { fetchJson, patchJson, postJson } from "../http-client.js";

export class GoalCommand extends Command {
  static override description = "Manage project goals.";

  static override args = {
    action: Args.string(),
    goalId: Args.string()
  };

  static override flags = {
    actor: Flags.string(),
    "actor-id": Flags.string(),
    "api-url": Flags.string(),
    branch: Flags.string(),
    description: Flags.string(),
    "dry-run": Flags.boolean(),
    format: Flags.string(),
    level: Flags.string(),
    priority: Flags.string(),
    "project-id": Flags.string(),
    root: Flags.string(),
    "session-cookie": Flags.string()
  };

  override async run(): Promise<void> {
    const parsed = await this.parse(GoalCommand);

    await runGoal(
      parsed.flags,
      parsed.args.action,
      parsed.args.goalId,
      this.log.bind(this)
    );
  }
}

export async function runGoal(
  flags: GoalCliFlags,
  action: string | undefined,
  goalId: string | undefined,
  writeLine: (message: string) => void
): Promise<void> {
  if (action === "create") return createGoal(flags, writeLine);
  if (action === "list") return listGoals(flags, writeLine);
  if (action === "promote") return promoteGoal(flags, goalId, writeLine);
  if (action === "show") return showGoal(flags, goalId, writeLine);
  if (action === "reject") return rejectGoal(flags, goalId, writeLine);
  throw new Error("Missing goal action.");
}

function printGoalCommandBody<T>(
  format: string | undefined,
  data: T,
  human: (body: T, writeLine: (message: string) => void) => void,
  writeLine: (message: string) => void
): void {
  if (format === "agent") {
    writeLine(JSON.stringify(buildAgentEnvelope({ data }), null, 2));
    return;
  }
  human(data, writeLine);
}

async function rejectGoal(
  flags: GoalCliFlags,
  goalId: string | undefined,
  writeLine: (message: string) => void
): Promise<void> {
  const goalFlags = goalIdFlagsFrom(flags, goalId);
  const response = await patchJson(
    `${goalFlags.apiUrl}/v1/goals/${goalFlags.goalId}`,
    goalPatchRequestSchema.parse({ status: "REJECTED" }),
    { Cookie: goalFlags.sessionCookie }
  );
  const body = goalPatchResponseSchema.parse(response.body);

  printGoalCommandBody(flags.format, body, printGoalResponse, writeLine);
}

async function showGoal(
  flags: GoalCliFlags,
  goalId: string | undefined,
  writeLine: (message: string) => void
): Promise<void> {
  const goalFlags = goalIdFlagsFrom(flags, goalId);
  const response = await fetchJson(`${goalFlags.apiUrl}/v1/goals/${goalFlags.goalId}`, {
    headers: {
      Cookie: goalFlags.sessionCookie
    }
  });
  const body = goalShowResponseSchema.parse(response.body);

  printGoalCommandBody(flags.format, body, printGoalResponse, writeLine);
}

async function createGoal(
  flags: GoalCliFlags,
  writeLine: (message: string) => void
): Promise<void> {
  const goalFlags = goalCreateFlagsFrom(flags);
  const body = goalCreateRequestSchema.parse({
    ...(goalFlags.actor === undefined ? {} : { actor: goalFlags.actor }),
    ...(goalFlags.actorId === undefined ? {} : { actor_id: goalFlags.actorId }),
    description: goalFlags.description,
    level: goalFlags.level,
    priority: goalFlags.priority
  });
  await runMutationCommand<GoalCreateResponse>(
    {
      body,
      method: "POST",
      path: `/v1/projects/${goalFlags.projectId}/goals`,
      selectData: (responseBody) => goalCreateResponseSchema.parse(responseBody),
      successHints: (data) => [{ command: data.recommended_next_command }]
    },
    commonMutationContextFrom(goalFlags),
    { format: flags.format, human: printGoalResponse, writeLine }
  );
}

async function listGoals(
  flags: GoalCliFlags,
  writeLine: (message: string) => void
): Promise<void> {
  const goalFlags = goalListFlagsFrom(flags);
  const url = new URL(`/v1/projects/${goalFlags.projectId}/goals`, goalFlags.apiUrl);
  if (goalFlags.actorId !== undefined) {
    url.searchParams.set("actor_id", goalFlags.actorId);
  }
  goalListQuerySchema.parse(Object.fromEntries(url.searchParams));

  const response = await fetchJson(url, {
    headers: {
      Cookie: goalFlags.sessionCookie
    }
  });
  const body = goalListResponseSchema.parse(response.body);

  printGoalCommandBody(flags.format, body, printGoalList, writeLine);
}

async function promoteGoal(
  flags: GoalCliFlags,
  goalId: string | undefined,
  writeLine: (message: string) => void
): Promise<void> {
  const goalFlags = goalIdFlagsFrom(flags, goalId);
  const response = await postJson(
    `${goalFlags.apiUrl}/v1/goals/${goalFlags.goalId}/promote`,
    {},
    {
      Cookie: goalFlags.sessionCookie
    }
  );
  const body = goalPromotionResponseSchema.parse(response.body);

  printGoalCommandBody(flags.format, body, printGoalPromotion, writeLine);
}
