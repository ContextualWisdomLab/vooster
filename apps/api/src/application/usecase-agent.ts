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
  if (found.usecase.archived_at !== null) {
    return { status: "ARCHIVED" };
  }
  if (input.format !== "agent") {
    return {
      data: await agentData(deps, found.projectId, found.usecase),
      status: "SIMPLE",
      usecase: found.usecase
    };
  }

  const session = await activeSession(deps.workSessionStore, input.sessionId);
  const pinned = session?.pinned_revisions?.[found.usecase.id];
  const revision =
    pinned ??
    (await resolveRevision(deps.revisionStore, found.usecase, input.requestedRevision));
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
      found.usecase,
      revision,
      session?.id ?? null,
      warningsFor(session, pinned, input.requestedRevision),
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
  session: StoredWorkSession | undefined,
  pinned: string | undefined,
  requestedRevision: string | undefined
): AgentWarning[] {
  if (
    pinned !== undefined &&
    requestedRevision !== undefined &&
    requestedRevision !== pinned
  ) {
    return [
      {
        message:
          "Requested revision was ignored because the active session pins this use case.",
        type: "REVISION_OVERRIDDEN_BY_SESSION"
      }
    ];
  }
  if (session !== undefined && pinned === undefined) {
    return [
      {
        message:
          "Session does not pin this use case; concurrent edits may change future reads.",
        type: "UNPINNED_SESSION_READ"
      }
    ];
  }
  return [];
}

function suggestedActions(usecase: StoredUseCase, warnings: Array<{ type: string }>) {
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
  requestedRevision: string | undefined
): Promise<string | undefined> {
  if (requestedRevision === undefined) {
    return usecase.current_revision_id;
  }
  const exists = (await revisionStore.listRevisions(usecase.id)).some(
    (revision) => revision.id === requestedRevision
  );
  return exists ? requestedRevision : undefined;
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
