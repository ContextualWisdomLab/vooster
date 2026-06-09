import { agentData } from "./usecase-agent-data.js";
import type {
  AgentEnvelope,
  AgentWarning,
  ShowUseCaseInput,
  ShowUseCaseResult,
  UseCaseAgentDeps
} from "./usecase-agent-types.js";
import type { StoredUseCase, StoredWorkSession } from "../domain/entities/index.js";
import type { RevisionStore } from "../ports/revision-store.js";
import type { WorkSessionStore } from "../ports/work-session-store.js";

export async function showUseCaseForAgent(
  deps: UseCaseAgentDeps,
  input: ShowUseCaseInput
): Promise<ShowUseCaseResult> {
  const found = await deps.useCaseStore.findUseCaseWithProject(input.usecaseId);
  if (found === undefined) {
    return { status: "NOT_FOUND" };
  }
  if (
    input.userId === undefined ||
    (await deps.membershipStore.membershipForProject(found.projectId, input.userId)) ===
      undefined
  ) {
    return { status: "AUTHENTICATION_REQUIRED" };
  }
  const headRevision = await latestRevisionId(deps.revisionStore, found.usecase);
  const usecaseAtHead = { ...found.usecase, current_revision_id: headRevision };
  if (input.format !== "agent") {
    return {
      data: await agentData(deps, found.projectId, usecaseAtHead),
      status: "SIMPLE",
      usecase: usecaseAtHead
    };
  }

  const session = await activeSession(deps.workSessionStore, input.sessionId);
  const pinned = session?.pinned_revisions?.[found.usecase.id];
  const revision =
    pinned ??
    (await resolveRevision(
      deps.revisionStore,
      found.usecase,
      input.requestedRevision,
      headRevision
    ));
  if (revision === undefined) {
    return {
      revision: input.requestedRevision,
      status: "REVISION_NOT_FOUND",
      usecaseKey: found.usecase.key
    };
  }

  return {
    envelope: await agentEnvelope(
      deps,
      found.projectId,
      usecaseAtHead,
      revision,
      session?.id ?? null,
      warningsFor(usecaseAtHead, session, pinned, input.requestedRevision),
      input.requestId
    ),
    status: "AGENT_ENVELOPE"
  };
}

async function agentEnvelope(
  deps: UseCaseAgentDeps,
  projectId: string,
  usecase: StoredUseCase,
  revision: string,
  sessionId: null | string,
  warnings: AgentWarning[],
  requestId: string
): Promise<AgentEnvelope> {
  const project = await deps.projectStore.findProjectById(projectId);
  return {
    context: {
      branch: "main",
      project_key: project?.key ?? "",
      request_id: requestId,
      revision,
      session_id: sessionId
    },
    data: await agentData(deps, projectId, usecase),
    format_version: 1,
    suggested_next_actions: suggestedActions(usecase, warnings),
    warnings
  };
}

function warningsFor(
  usecase: StoredUseCase,
  session: StoredWorkSession | undefined,
  pinned: string | undefined,
  requestedRevision: string | undefined
): AgentWarning[] {
  const warnings: AgentWarning[] = [];
  if (usecase.archived_at !== null) {
    warnings.push({
      message:
        "This use case is archived; reads are allowed but edits require restore.",
      type: "ARCHIVED_READ_ONLY"
    });
  }
  if (
    pinned !== undefined &&
    requestedRevision !== undefined &&
    requestedRevision !== pinned
  ) {
    warnings.push({
      message:
        "Requested revision was ignored because the active session pins this use case.",
      type: "REVISION_OVERRIDDEN_BY_SESSION"
    });
    return warnings;
  }
  if (session !== undefined && pinned === undefined) {
    warnings.push({
      message:
        "Session does not pin this use case; concurrent edits may change future reads.",
      type: "UNPINNED_SESSION_READ"
    });
    return warnings;
  }
  return warnings;
}

function suggestedActions(usecase: StoredUseCase, warnings: Array<{ type: string }>) {
  if (usecase.archived_at !== null) {
    return [
      {
        command: `vspec usecase restore ${usecase.key}`,
        reason: "Restore the archived use case before proposing edits."
      },
      {
        command: "vspec usecase list --archived",
        reason: "Browse archived use cases without changing state."
      }
    ];
  }
  return [
    {
      command: `vspec change propose ${usecase.key}`,
      reason: "Propose a reviewed spec change after reading the pinned snapshot."
    },
    {
      command: `vspec export gherkin ${usecase.key}`,
      reason: "Generate executable acceptance-test scaffolding."
    },
    ...(warnings.some((warning) => warning.type === "UNPINNED_SESSION_READ")
      ? [
          {
            command: `vspec session pin ${usecase.key}`,
            reason: "Pin this use case before relying on it for edits."
          }
        ]
      : [])
  ];
}

async function resolveRevision(
  revisionStore: RevisionStore,
  usecase: StoredUseCase,
  requestedRevision: string | undefined,
  headRevision: string
): Promise<string | undefined> {
  if (requestedRevision === undefined) {
    return headRevision;
  }
  const exists = (await revisionStore.listRevisions(usecase.id)).some(
    (revision) => revision.id === requestedRevision
  );
  return exists ? requestedRevision : undefined;
}

async function latestRevisionId(revisionStore: RevisionStore, usecase: StoredUseCase) {
  return (
    (await revisionStore.latestRevision(usecase.id))?.id ?? usecase.current_revision_id
  );
}

async function activeSession(
  workSessionStore: WorkSessionStore,
  sessionId: string | undefined
) {
  if (sessionId === undefined) {
    return undefined;
  }
  const session = await workSessionStore.findWorkSessionById(sessionId);
  return session?.status === "ACTIVE" ? session : undefined;
}
