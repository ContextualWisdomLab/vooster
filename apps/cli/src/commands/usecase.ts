import { Args, Command, Flags } from "@oclif/core";
import {
  usecaseAgentEnvelopeSchema,
  usecaseArchiveResponseSchema,
  usecaseCreateRequestSchema,
  usecaseCreateResponseSchema,
  usecaseListResponseSchema,
  usecasePatchRequestSchema,
  usecaseRestoreResponseSchema,
  usecaseShowResponseSchema,
  usecaseUpdateResponseSchema,
  stakeholderInterestAddResponseSchema,
  stakeholderInterestRequestSchema,
  type SuggestedNextAction,
  type StakeholderInterestAddResponse,
  type UsecaseCreateResponse
} from "@vooster/contracts";

import { writeAgentErrorEnvelope } from "./agent-error-envelope.js";
import {
  stakeholderInterestFlagsFrom,
  usecaseArchiveFlagsFrom,
  usecaseCreateFlagsFrom,
  usecaseListFlagsFrom,
  usecaseSetFlagsFrom,
  usecaseShowFlagsFrom,
  type UsecaseCliFlags
} from "./usecase-flags.js";
import { runVerify } from "./verify.js";
import {
  printStakeholderInterest,
  printUsecase,
  printUsecaseArchive,
  printUsecaseList,
  printUsecaseRestore,
  printUsecaseShow,
  printUsecaseUpdate
} from "./usecase-output.js";
import { buildAgentEnvelope } from "../agent-envelope.js";
import {
  commonMutationContextFrom,
  runMutationCommand
} from "../application/mutation-command.js";
import { deleteJson, fetchJson, patchJson } from "../http-client.js";

export class UsecaseCommand extends Command {
  static override description = "Manage project use cases.";

  static override args = {
    action: Args.string(),
    usecaseId: Args.string()
  };

  static override flags = {
    all: Flags.boolean(),
    "actor-id": Flags.string(),
    "api-url": Flags.string(),
    archived: Flags.boolean(),
    branch: Flags.string(),
    cursor: Flags.string(),
    "dry-run": Flags.boolean(),
    field: Flags.string(),
    format: Flags.string(),
    force: Flags.boolean(),
    interest: Flags.string(),
    level: Flags.string(),
    limit: Flags.string(),
    "primary-actor": Flags.string(),
    "project-id": Flags.string(),
    "protection-mechanism": Flags.string(),
    q: Flags.string(),
    revision: Flags.string(),
    root: Flags.string(),
    session: Flags.string(),
    "session-cookie": Flags.string(),
    stakeholder: Flags.string(),
    status: Flags.string(),
    "test-cmd": Flags.string(),
    title: Flags.string(),
    value: Flags.string()
  };

  override async run(): Promise<void> {
    const parsed = await this.parse(UsecaseCommand);

    await runUsecase(
      parsed.flags,
      parsed.args.action,
      parsed.args.usecaseId,
      this.log.bind(this)
    );
  }
}

export async function runUsecase(
  flags: UsecaseCliFlags,
  action: string | undefined,
  usecaseId: string | undefined,
  writeLine: (message: string) => void
): Promise<void> {
  if (action === "create") {
    await createUsecase(flags, writeLine);
    return;
  }
  if (action === "add-stakeholder") {
    await addStakeholderInterest(flags, usecaseId, writeLine);
    return;
  }
  if (action === "list") {
    await listUsecases(flags, writeLine);
    return;
  }
  if (action === "show") {
    await showUsecase(flags, usecaseId, writeLine);
    return;
  }
  if (action === "archive") {
    await archiveUsecase(flags, usecaseId, writeLine);
    return;
  }
  if (action === "set") {
    await setUsecase(flags, usecaseId, writeLine);
    return;
  }
  if (action === "restore") {
    await restoreUsecase(flags, usecaseId, writeLine);
    return;
  }
  if (action === "verify") {
    await runVerify(flags, usecaseId, writeLine);
    return;
  }

  throw new Error("Missing usecase action.");
}

async function restoreUsecase(
  flags: UsecaseCliFlags,
  usecaseId: string | undefined,
  writeLine: (message: string) => void
): Promise<void> {
  const restoreFlags = usecaseArchiveFlagsFrom(flags, usecaseId);
  const response = await patchJson(
    `${restoreFlags.apiUrl}/v1/usecases/${restoreFlags.usecaseId}`,
    usecasePatchRequestSchema.parse({ archived_at: null }),
    {
      Cookie: restoreFlags.sessionCookie
    }
  );

  printUsecaseRestore(usecaseRestoreResponseSchema.parse(response.body), writeLine);
}

async function setUsecase(
  flags: UsecaseCliFlags,
  usecaseId: string | undefined,
  writeLine: (message: string) => void
): Promise<void> {
  try {
    const setFlags = usecaseSetFlagsFrom(flags, usecaseId);
    const response = await patchJson(
      `${setFlags.apiUrl}/v1/usecases/${setFlags.usecaseId}`,
      usecasePatchRequestSchema.parse({ [setFlags.field]: setFlags.value }),
      {
        Cookie: setFlags.sessionCookie
      }
    );

    const body = usecaseUpdateResponseSchema.parse(response.body);
    if (flags.format === "agent") {
      writeLine(JSON.stringify(buildAgentEnvelope({ data: body }), null, 2));
      return;
    }

    printUsecaseUpdate(body, writeLine);
  } catch (error: unknown) {
    if (
      flags.format === "agent" &&
      writeAgentErrorEnvelope({
        error,
        suggestedNextActions: usecaseSetErrorActions(flags),
        validationMessage: "Invalid use case update.",
        writeLine
      })
    ) {
      return;
    }
    throw error;
  }
}

async function createUsecase(
  flags: UsecaseCliFlags,
  writeLine: (message: string) => void
): Promise<void> {
  const u = usecaseCreateFlagsFrom(flags);
  const body = usecaseCreateRequestSchema.parse({
    force: u.force,
    primary_actor: u.primaryActor,
    title: u.title
  });
  await runMutationCommand<UsecaseCreateResponse>(
    {
      body,
      method: "POST",
      path: `/v1/projects/${u.projectId}/usecases`,
      selectData: (responseBody) => usecaseCreateResponseSchema.parse(responseBody)
    },
    commonMutationContextFrom(u),
    { format: flags.format, human: printUsecase, writeLine }
  );
}

async function addStakeholderInterest(
  flags: UsecaseCliFlags,
  usecaseId: string | undefined,
  writeLine: (message: string) => void
): Promise<void> {
  const interestFlags = stakeholderInterestFlagsFrom(flags, usecaseId);
  const body = stakeholderInterestRequestSchema.parse({
    interest: interestFlags.interest,
    protection_mechanism: interestFlags.protectionMechanism,
    stakeholder: interestFlags.stakeholder
  });
  await runMutationCommand<StakeholderInterestAddResponse>(
    {
      body,
      method: "POST",
      path: `/v1/usecases/${interestFlags.usecaseId}/stakeholder-interests`,
      selectData: (responseBody) =>
        stakeholderInterestAddResponseSchema.parse(responseBody)
    },
    commonMutationContextFrom(interestFlags),
    { format: flags.format, human: printStakeholderInterest, writeLine }
  );
}

async function listUsecases(
  flags: UsecaseCliFlags,
  writeLine: (message: string) => void
): Promise<void> {
  const listFlags = usecaseListFlagsFrom(flags);
  const url = new URL(`/v1/projects/${listFlags.projectId}/usecases`, listFlags.apiUrl);
  setSearchParam(url, "actor_id", listFlags.actorId);
  setSearchParam(url, "archived", listFlags.archived);
  setSearchParam(url, "cursor", listFlags.cursor);
  setSearchParam(url, "level", listFlags.level);
  setSearchParam(url, "limit", listFlags.limit);
  setSearchParam(url, "q", listFlags.q);
  setSearchParam(url, "status", listFlags.status);

  const response = await fetchJson(url, {
    headers: {
      Cookie: listFlags.sessionCookie
    }
  });

  printUsecaseList(usecaseListResponseSchema.parse(response.body), writeLine);
}

async function showUsecase(
  flags: UsecaseCliFlags,
  usecaseId: string | undefined,
  writeLine: (message: string) => void
): Promise<void> {
  const showFlags = usecaseShowFlagsFrom(flags, usecaseId);
  const url = new URL(`/v1/usecases/${showFlags.usecaseId}`, showFlags.apiUrl);
  url.searchParams.set("format", showFlags.format);
  setSearchParam(url, "revision", showFlags.revision);
  setSearchParam(url, "session", showFlags.session);

  const response = await fetchJson(url, {
    headers: {
      Cookie: showFlags.sessionCookie
    }
  });

  if (showFlags.format === "agent") {
    const agentBody = agentBodyFrom(usecaseAgentEnvelopeSchema.parse(response.body));
    writeLine(
      JSON.stringify(
        buildAgentEnvelope({
          data: agentBody.data,
          context: agentBody.context,
          suggested_next_actions: agentBody.suggested_next_actions,
          warnings: agentBody.warnings
        }),
        null,
        2
      )
    );
    return;
  }

  if (showFlags.format === "json") {
    writeLine(JSON.stringify(response.body, null, 2));
    return;
  }

  printUsecaseShow(usecaseShowResponseSchema.parse(response.body), writeLine);
}

async function archiveUsecase(
  flags: UsecaseCliFlags,
  usecaseId: string | undefined,
  writeLine: (message: string) => void
): Promise<void> {
  const archiveFlags = usecaseArchiveFlagsFrom(flags, usecaseId);
  const response = await deleteJson(
    `${archiveFlags.apiUrl}/v1/usecases/${archiveFlags.usecaseId}`,
    {
      Cookie: archiveFlags.sessionCookie
    }
  );

  printUsecaseArchive(usecaseArchiveResponseSchema.parse(response.body), writeLine);
}

function setSearchParam(url: URL, name: string, value: string | undefined): void {
  if (value !== undefined) {
    url.searchParams.set(name, value);
  }
}

function usecaseSetErrorActions(flags: UsecaseCliFlags): SuggestedNextAction[] {
  return [
    ...(flags.field === "level"
      ? [
          {
            command: "vspec usecase set <usecase-id> --field level --value SUMMARY",
            reason: "Allowed levels are SUMMARY, USER_GOAL, and SUBFUNCTION."
          }
        ]
      : [
          {
            command:
              "vspec usecase set <usecase-id> --field title|level|priority|format|status|scope --value <value>",
            reason: "Choose one of the supported metadata fields."
          }
        ]),
    {
      command: "vspec usecase list",
      reason: "Find an existing use case key before setting metadata."
    }
  ];
}

function agentBodyFrom(body: unknown): {
  context?: {
    branch?: string | null;
    project_key?: string | null;
    revision?: string | null;
    session_id?: string | null;
  };
  data: unknown;
  suggested_next_actions?: Array<{ command: string; reason?: string }>;
  warnings?: Array<{ message: string }>;
} {
  if (!isRecord(body)) {
    return { data: body };
  }

  return {
    context: isRecord(body.context) ? body.context : undefined,
    data: body.data ?? body,
    suggested_next_actions: isSuggestedActions(body.suggested_next_actions)
      ? body.suggested_next_actions
      : undefined,
    warnings: isWarnings(body.warnings) ? body.warnings : undefined
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isSuggestedActions(
  value: unknown
): value is Array<{ command: string; reason?: string }> {
  return (
    Array.isArray(value) &&
    value.every((item) => isRecord(item) && typeof item.command === "string")
  );
}

function isWarnings(value: unknown): value is Array<{ message: string }> {
  return (
    Array.isArray(value) &&
    value.every((item) => isRecord(item) && typeof item.message === "string")
  );
}
