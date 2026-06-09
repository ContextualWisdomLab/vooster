import { Args, Command, Flags } from "@oclif/core";
import {
  scenarioStepCreateRequestSchema,
  scenarioStepCreateResponseSchema,
  stepMoveRequestSchema,
  stepMoveResponseSchema,
  stepPatchRequestSchema,
  stepUpdateResponseSchema,
  type ScenarioStepCreateResponse as StepResponse,
  type StepUpdateResponse
} from "@vooster/contracts";

import {
  commonMutationContextFrom,
  runMutationCommand
} from "../application/mutation-command.js";
import {
  optionalFlag,
  requiredArgument,
  requiredFlag,
  resolveContextFlag
} from "../flag-values.js";

type StepCliFlags = {
  action?: string;
  actor?: string;
  "api-url"?: string;
  at?: string;
  "base-revision"?: string;
  branch?: string;
  "dry-run"?: boolean;
  format?: string;
  implements?: string;
  "project-id"?: string;
  root?: string;
  "session-cookie"?: string;
  to?: string;
};

type StepCreateFlags = {
  action: string;
  actor: string;
  apiUrl: string;
  branch: string;
  dryRun: boolean;
  projectId: string | null;
  root: string;
  scenarioId: string;
  sessionCookie: string;
  position?: number;
};

type StepEditFlags = {
  action?: string;
  apiUrl: string;
  actor?: string;
  baseRevision: string;
  implementationRefs?: string[];
  sessionCookie: string;
  stepId: string;
};

type StepMoveFlags = {
  apiUrl: string;
  branch: string;
  dryRun: boolean;
  projectId: string | null;
  root: string;
  sessionCookie: string;
  stepId: string;
  toPosition: number;
};

export class StepCommand extends Command {
  static override description = "Manage scenario steps.";

  static override args = {
    actionName: Args.string(),
    targetId: Args.string()
  };

  static override flags = {
    action: Flags.string(),
    actor: Flags.string(),
    "api-url": Flags.string(),
    at: Flags.string(),
    "base-revision": Flags.string(),
    branch: Flags.string(),
    "dry-run": Flags.boolean(),
    format: Flags.string(),
    implements: Flags.string(),
    "project-id": Flags.string(),
    root: Flags.string(),
    "session-cookie": Flags.string(),
    to: Flags.string()
  };

  override async run(): Promise<void> {
    const parsed = await this.parse(StepCommand);

    await runStep(
      parsed.flags,
      parsed.args.actionName,
      parsed.args.targetId,
      this.log.bind(this)
    );
  }
}

export async function runStep(
  flags: StepCliFlags,
  action: string | undefined,
  targetId: string | undefined,
  writeLine: (message: string) => void
): Promise<void> {
  if (action === "add") {
    await addStep(flags, targetId, writeLine);
    return;
  }
  if (action === "edit") {
    await editStep(flags, targetId, writeLine);
    return;
  }
  if (action === "move") {
    await moveStep(flags, targetId, writeLine);
    return;
  }

  throw new Error("Missing step action.");
}

async function addStep(
  flags: StepCliFlags,
  scenarioId: string | undefined,
  writeLine: (message: string) => void
): Promise<void> {
  const s = stepCreateFlagsFrom(flags, scenarioId);
  const actor = s.actor;
  const body = scenarioStepCreateRequestSchema.parse({
    action: s.action,
    actor: s.actor,
    position: s.position
  });
  await runMutationCommand<StepResponse>(
    {
      body,
      context: (data) => ({ revision: data.revision.id ?? null }),
      method: "POST",
      path: `/v1/scenarios/${s.scenarioId}/steps`,
      selectData: (responseBody) => scenarioStepCreateResponseSchema.parse(responseBody)
    },
    commonMutationContextFrom(s),
    {
      format: flags.format,
      human: (body, write) => {
        printStepAdd(body, actor, write);
      },
      writeLine
    }
  );
}

async function moveStep(
  flags: StepCliFlags,
  stepId: string | undefined,
  writeLine: (message: string) => void
): Promise<void> {
  const s = stepMoveFlagsFrom(flags, stepId);
  const body = stepMoveRequestSchema.parse({
    to: s.toPosition
  });
  await runMutationCommand<StepResponse>(
    {
      body,
      context: (data) => ({ revision: data.revision.id ?? null }),
      method: "POST",
      path: `/v1/steps/${s.stepId}/move`,
      selectData: (responseBody) => stepMoveResponseSchema.parse(responseBody)
    },
    commonMutationContextFrom(s),
    {
      format: flags.format,
      human: (body, write) => {
        printStepMove(body, write);
      },
      writeLine
    }
  );
}

function printStepAdd(
  body: StepResponse,
  actor: string,
  writeLine: (message: string) => void
): void {
  writeLine(`Step ${body.step.id ?? ""}`);
  writeLine(`${String(body.step.step_number)}. ${actor} ${body.step.action ?? ""}`);
  writeLine(`Revision id ${body.revision.id ?? ""}`);
  writeLine(
    `Revision ${body.revision.severity ?? ""} version ${String(body.revision.version_number)}`
  );
  for (const step of body.scenario_steps) {
    writeLine(`${String(step.step_number)}. ${step.action ?? ""}`);
  }
}

function printStepMove(body: StepResponse, writeLine: (message: string) => void): void {
  writeLine(`Step ${body.step.id ?? ""}`);
  writeLine(`Moved to ${String(body.step.step_number ?? "")}`);
  writeLine(`Revision id ${body.revision.id ?? ""}`);
  writeLine(
    `Revision ${body.revision.severity ?? ""} version ${String(body.revision.version_number)}`
  );
  for (const step of body.scenario_steps) {
    writeLine(`${String(step.step_number)}. ${step.action ?? ""}`);
  }
}

async function editStep(
  flags: StepCliFlags,
  stepId: string | undefined,
  writeLine: (message: string) => void
): Promise<void> {
  const stepFlags = stepEditFlagsFrom(flags, stepId);
  const body = stepPatchRequestSchema.parse({
    action: stepFlags.action,
    actor: stepFlags.actor,
    base_revision: stepFlags.baseRevision,
    implements: stepFlags.implementationRefs
  });
  await runMutationCommand<StepUpdateResponse>(
    {
      body,
      context: () => ({ revision: null }),
      method: "PATCH",
      path: `/v1/steps/${stepFlags.stepId}`,
      selectData: (responseBody) => stepUpdateResponseSchema.parse(responseBody)
    },
    commonMutationContextFrom({
      apiUrl: stepFlags.apiUrl,
      branch: "main",
      dryRun: false,
      projectId: null,
      root: process.cwd(),
      sessionCookie: stepFlags.sessionCookie
    }),
    {
      format: flags.format,
      human: printStepEdit,
      writeLine
    }
  );
}

function printStepEdit(
  body: StepUpdateResponse,
  writeLine: (message: string) => void
): void {
  writeLine(`Step ${body.step.id ?? ""}`);
  writeLine(`Action ${body.step.action ?? ""}`);
  writeLine(
    `Revision ${body.revision.severity ?? ""} version ${String(body.revision.version_number)}`
  );
  writeLine(`Affected sessions ${body.affected_sessions.join(", ") || "none"}`);
}

function stepCreateFlagsFrom(
  flags: StepCliFlags,
  scenarioId: string | undefined
): StepCreateFlags {
  return {
    action: requiredFlag(flags, "action"),
    actor: requiredFlag(flags, "actor"),
    apiUrl: resolveContextFlag(flags, "api-url"),
    branch: flags.branch ?? "main",
    dryRun: flags["dry-run"] === true,
    projectId: optionalFlag(flags, "project-id") ?? null,
    root: flags.root ?? process.cwd(),
    scenarioId: requiredArgument(scenarioId, "scenario-id"),
    sessionCookie: resolveContextFlag(flags, "session-cookie"),
    position: optionalPositiveIntegerFlag(flags, "at")
  };
}

function stepEditFlagsFrom(
  flags: StepCliFlags,
  stepId: string | undefined
): StepEditFlags {
  return {
    action: optionalFlag(flags, "action"),
    apiUrl: resolveContextFlag(flags, "api-url"),
    actor: optionalFlag(flags, "actor"),
    baseRevision: requiredFlag(flags, "base-revision"),
    implementationRefs: implementationRefsFrom(optionalFlag(flags, "implements")),
    sessionCookie: resolveContextFlag(flags, "session-cookie"),
    stepId: requiredArgument(stepId, "step-id")
  };
}

function stepMoveFlagsFrom(
  flags: StepCliFlags,
  stepId: string | undefined
): StepMoveFlags {
  return {
    apiUrl: resolveContextFlag(flags, "api-url"),
    branch: flags.branch ?? "main",
    dryRun: flags["dry-run"] === true,
    projectId: optionalFlag(flags, "project-id") ?? null,
    root: flags.root ?? process.cwd(),
    sessionCookie: resolveContextFlag(flags, "session-cookie"),
    stepId: requiredArgument(stepId, "step-id"),
    toPosition: requiredPositiveIntegerFlag(flags, "to")
  };
}

function implementationRefsFrom(value: string | undefined): string[] | undefined {
  if (value === undefined) {
    return undefined;
  }
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function optionalPositiveIntegerFlag(
  flags: StepCliFlags,
  name: "at" | "to"
): number | undefined {
  const value = optionalFlag(flags, name);
  return value === undefined ? undefined : parsePositiveIntegerFlag(value, name);
}

function requiredPositiveIntegerFlag(flags: StepCliFlags, name: "at" | "to"): number {
  return parsePositiveIntegerFlag(requiredFlag(flags, name), name);
}

function parsePositiveIntegerFlag(value: string, name: "at" | "to"): number {
  if (!/^\d+$/.test(value)) {
    throw new Error(`--${name} must be a positive integer.`);
  }
  return Number.parseInt(value, 10);
}
