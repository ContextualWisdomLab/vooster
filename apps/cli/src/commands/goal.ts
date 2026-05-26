import { Args, Command, Flags } from "@oclif/core";

import {
  goalCreateFlagsFrom,
  goalIdFlagsFrom,
  goalListFlagsFrom,
  type GoalCliFlags
} from "./goal-flags.js";
import {
  printGoalList,
  printGoalPromotion,
  printGoalResponse,
  type GoalListResponse,
  type GoalPromotionResponse,
  type GoalResponse
} from "./goal-output.js";
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
  if (action === "show") {
    await showGoal(flags, goalId, writeLine);
    return;
  }
  if (action === "reject") {
    await rejectGoal(flags, goalId, writeLine);
    return;
  }

  throw new Error("Missing goal action.");
}

async function rejectGoal(
  flags: GoalCliFlags,
  goalId: string | undefined,
  writeLine: (message: string) => void
): Promise<void> {
  const goalFlags = goalIdFlagsFrom(flags, goalId);
  const response = await patchJson(
    `${goalFlags.apiUrl}/v1/goals/${goalFlags.goalId}`,
    { status: "REJECTED" },
    { Cookie: goalFlags.sessionCookie }
  );

  if (flags.format === "agent") {
    writeLine(JSON.stringify(buildAgentEnvelope({ data: response.body }), null, 2));
    return;
  }

  printGoalResponse(response.body as GoalResponse, writeLine);
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

  if (flags.format === "agent") {
    writeLine(JSON.stringify(buildAgentEnvelope({ data: response.body }), null, 2));
    return;
  }

  printGoalResponse(response.body as GoalResponse, writeLine);
}

async function createGoal(
  flags: GoalCliFlags,
  writeLine: (message: string) => void
): Promise<void> {
  const goalFlags = goalCreateFlagsFrom(flags);
  await runMutationCommand<GoalResponse>(
    {
      body: {
        ...(goalFlags.actor === undefined ? {} : { actor: goalFlags.actor }),
        ...(goalFlags.actorId === undefined ? {} : { actor_id: goalFlags.actorId }),
        description: goalFlags.description,
        level: goalFlags.level,
        priority: goalFlags.priority
      },
      method: "POST",
      path: `/v1/projects/${goalFlags.projectId}/goals`,
      successHints: (data) =>
        data.recommended_next_command === undefined
          ? []
          : [{ command: data.recommended_next_command }]
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

  const response = await fetchJson(url, {
    headers: {
      Cookie: goalFlags.sessionCookie
    }
  });
  const body = response.body as GoalListResponse;

  if (flags.format === "agent") {
    writeLine(JSON.stringify(buildAgentEnvelope({ data: body }), null, 2));
    return;
  }

  printGoalList(body, writeLine);
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
  const body = response.body as GoalPromotionResponse;

  if (flags.format === "agent") {
    writeLine(JSON.stringify(buildAgentEnvelope({ data: body }), null, 2));
    return;
  }

  printGoalPromotion(body, writeLine);
}
