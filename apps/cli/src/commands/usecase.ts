import { Args, Command, Flags } from "@oclif/core";

import {
  stakeholderInterestFlagsFrom,
  usecaseArchiveFlagsFrom,
  usecaseCreateFlagsFrom,
  usecaseListFlagsFrom,
  usecaseShowFlagsFrom,
  type UsecaseCliFlags
} from "./usecase-flags.js";
import {
  printStakeholderInterest,
  printUsecase,
  printUsecaseArchive,
  printUsecaseList,
  printUsecaseShow,
  type StakeholderInterestResponse,
  type UsecaseArchiveResponse,
  type UsecaseListResponse,
  type UsecaseResponse,
  type UsecaseShowResponse
} from "./usecase-output.js";
import { deleteJson, fetchJson, postJson } from "../http-client.js";

export class UsecaseCommand extends Command {
  static override description = "Manage project use cases.";

  static override args = {
    action: Args.string(),
    usecaseId: Args.string()
  };

  static override flags = {
    "actor-id": Flags.string(),
    "api-url": Flags.string(),
    cursor: Flags.string(),
    format: Flags.string(),
    interest: Flags.string(),
    level: Flags.string(),
    limit: Flags.string(),
    "primary-actor": Flags.string(),
    "project-id": Flags.string(),
    "protection-mechanism": Flags.string(),
    q: Flags.string(),
    revision: Flags.string(),
    session: Flags.string(),
    "session-cookie": Flags.string(),
    stakeholder: Flags.string(),
    status: Flags.string(),
    title: Flags.string()
  };

  override async run(): Promise<void> {
    const parsed = await this.parse(UsecaseCommand);

    await runUsecase(parsed.flags, parsed.args.action, parsed.args.usecaseId, this.log.bind(this));
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

  throw new Error("Missing usecase action.");
}

async function createUsecase(
  flags: UsecaseCliFlags,
  writeLine: (message: string) => void
): Promise<void> {
  const usecaseFlags = usecaseCreateFlagsFrom(flags);
  const response = await postJson(
    `${usecaseFlags.apiUrl}/v1/projects/${usecaseFlags.projectId}/usecases`,
    {
      primary_actor: usecaseFlags.primaryActor,
      title: usecaseFlags.title
    },
    {
      Cookie: usecaseFlags.sessionCookie
    }
  );

  printUsecase(response.body as UsecaseResponse, writeLine);
}

async function addStakeholderInterest(
  flags: UsecaseCliFlags,
  usecaseId: string | undefined,
  writeLine: (message: string) => void
): Promise<void> {
  const interestFlags = stakeholderInterestFlagsFrom(flags, usecaseId);
  const response = await postJson(
    `${interestFlags.apiUrl}/v1/usecases/${interestFlags.usecaseId}/stakeholder-interests`,
    {
      interest: interestFlags.interest,
      protection_mechanism: interestFlags.protectionMechanism,
      stakeholder: interestFlags.stakeholder
    },
    {
      Cookie: interestFlags.sessionCookie
    }
  );

  printStakeholderInterest(response.body as StakeholderInterestResponse, writeLine);
}

async function listUsecases(
  flags: UsecaseCliFlags,
  writeLine: (message: string) => void
): Promise<void> {
  const listFlags = usecaseListFlagsFrom(flags);
  const url = new URL(`/v1/projects/${listFlags.projectId}/usecases`, listFlags.apiUrl);
  setSearchParam(url, "actor_id", listFlags.actorId);
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

  printUsecaseList(response.body as UsecaseListResponse, writeLine);
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

  if (showFlags.format === "agent" || showFlags.format === "json") {
    writeLine(JSON.stringify(response.body, null, 2));
    return;
  }

  printUsecaseShow(response.body as UsecaseShowResponse, writeLine);
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

  printUsecaseArchive(response.body as UsecaseArchiveResponse, writeLine);
}

function setSearchParam(url: URL, name: string, value: string | undefined): void {
  if (value !== undefined) {
    url.searchParams.set(name, value);
  }
}
