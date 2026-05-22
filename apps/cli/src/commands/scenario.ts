import { Args, Command, Flags } from "@oclif/core";

import { buildAgentEnvelope } from "../agent-envelope.js";
import { requiredArgument, requiredFlag, resolveContextFlag } from "../flag-values.js";
import { postJson } from "../http-client.js";

type ScenarioCliFlags = {
  at?: string;
  condition?: string;
  "api-url"?: string;
  format?: string;
  outcome?: string;
  "session-cookie"?: string;
  type?: string;
};

type ScenarioCreateFlags = {
  apiUrl: string;
  condition: string | undefined;
  extensionPoint: string | undefined;
  outcome: "FAILURE" | "PARTIAL" | "SUCCESS" | undefined;
  sessionCookie: string;
  type: "EXTENSION" | "MAIN_SUCCESS";
  usecaseId: string;
};

type ScenarioResponse = {
  revision: {
    id: string;
    severity: string;
    version_number: number;
  };
  scenario: {
    condition: string | null;
    extension_point: string | null;
    id: string;
    outcome: string;
    type: string;
  };
};

export class ScenarioCommand extends Command {
  static override description = "Manage use case scenarios.";

  static override args = {
    action: Args.string(),
    usecaseId: Args.string()
  };

  static override flags = {
    at: Flags.string(),
    condition: Flags.string(),
    "api-url": Flags.string(),
    format: Flags.string(),
    outcome: Flags.string(),
    "session-cookie": Flags.string(),
    type: Flags.string()
  };

  override async run(): Promise<void> {
    const parsed = await this.parse(ScenarioCommand);

    await runScenario(parsed.flags, parsed.args.action, parsed.args.usecaseId, this.log.bind(this));
  }
}

export async function runScenario(
  flags: ScenarioCliFlags,
  action: string | undefined,
  usecaseId: string | undefined,
  writeLine: (message: string) => void
): Promise<void> {
  if (action === "add") {
    await addScenario(flags, usecaseId, writeLine);
    return;
  }

  throw new Error("Missing scenario action.");
}

async function addScenario(
  flags: ScenarioCliFlags,
  usecaseId: string | undefined,
  writeLine: (message: string) => void
): Promise<void> {
  const scenarioFlags = scenarioCreateFlagsFrom(flags, usecaseId);
  const response = await postJson(
    `${scenarioFlags.apiUrl}/v1/usecases/${scenarioFlags.usecaseId}/scenarios`,
    {
      condition: scenarioFlags.condition,
      extension_point: scenarioFlags.extensionPoint,
      outcome: scenarioFlags.outcome,
      type: scenarioFlags.type
    },
    {
      Cookie: scenarioFlags.sessionCookie
    }
  );
  const body = response.body as ScenarioResponse;

  if (flags.format === "agent") {
    writeLine(JSON.stringify(buildAgentEnvelope({
      data: body,
      context: {
        revision: body.revision.id
      }
    }), null, 2));
    return;
  }

  writeLine(`Scenario ${body.scenario.id}`);
  writeLine(`Type ${body.scenario.type}`);
  if (body.scenario.extension_point !== null) {
    writeLine(`At ${body.scenario.extension_point}`);
  }
  if (body.scenario.condition !== null) {
    writeLine(`Condition ${body.scenario.condition}`);
  }
  writeLine(`Outcome ${body.scenario.outcome}`);
  writeLine(`Revision ${body.revision.severity} version ${String(body.revision.version_number)}`);
}

function scenarioCreateFlagsFrom(
  flags: ScenarioCliFlags,
  usecaseId: string | undefined
): ScenarioCreateFlags {
  const type = scenarioType(requiredFlag(flags, "type"));
  return {
    apiUrl: resolveContextFlag(flags, "api-url"),
    condition: scenarioCondition(flags, type),
    extensionPoint: scenarioExtensionPoint(flags, type),
    outcome: scenarioOutcome(flags.outcome),
    sessionCookie: resolveContextFlag(flags, "session-cookie"),
    type,
    usecaseId: requiredArgument(usecaseId, "usecase-id")
  };
}

function scenarioType(rawType: string): "EXTENSION" | "MAIN_SUCCESS" {
  const type = rawType.toUpperCase().replaceAll("-", "_");
  if (type === "EXTENSION" || type === "MAIN_SUCCESS") {
    return type;
  }

  throw new Error("Scenario type must be MAIN_SUCCESS or EXTENSION.");
}

function scenarioOutcome(
  rawOutcome: string | undefined
): "FAILURE" | "PARTIAL" | "SUCCESS" | undefined {
  if (rawOutcome === undefined || rawOutcome.trim() === "") {
    return undefined;
  }

  const outcome = rawOutcome.toUpperCase();
  if (outcome === "FAILURE" || outcome === "PARTIAL" || outcome === "SUCCESS") {
    return outcome;
  }

  throw new Error("Scenario outcome must be FAILURE, PARTIAL, or SUCCESS.");
}

function scenarioCondition(
  flags: ScenarioCliFlags,
  type: "EXTENSION" | "MAIN_SUCCESS"
): string | undefined {
  return type === "EXTENSION" ? requiredFlag(flags, "condition") : undefined;
}

function scenarioExtensionPoint(
  flags: ScenarioCliFlags,
  type: "EXTENSION" | "MAIN_SUCCESS"
): string | undefined {
  return type === "EXTENSION" ? requiredFlag(flags, "at") : undefined;
}
