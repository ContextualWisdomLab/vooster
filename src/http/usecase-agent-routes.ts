import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { membershipForProject } from "./membership-support.js";
import { problem } from "./signup-support.js";
import type { SignupState, StoredUseCase } from "./signup-types.js";
import { useCaseWithProjectId } from "./usecase-support.js";
import type { ActorStore } from "../ports/actor-store.js";
import type { MembershipStore } from "../ports/membership-store.js";
import type { ProjectStore } from "../ports/project-store.js";

const paramsSchema = z.object({ usecaseId: z.string().min(1) });
const querySchema = z.object({
  format: z.enum(["agent", "human", "json"]).default("human"),
  revision: z.string().optional(),
  session: z.string().optional()
});

export function registerUseCaseAgentRoutes(
  app: FastifyInstance,
  state: SignupState,
  actorStore: ActorStore,
  membershipStore: MembershipStore,
  projectStore: ProjectStore
) {
  app.get("/v1/usecases/:usecaseId", (request, reply) =>
    showUseCase(request, reply, state, actorStore, membershipStore, projectStore)
  );
}

async function showUseCase(
  request: FastifyRequest,
  reply: FastifyReply,
  state: SignupState,
  actorStore: ActorStore,
  membershipStore: MembershipStore,
  projectStore: ProjectStore
) {
  const usecaseId = paramsSchema.parse(request.params).usecaseId;
  const query = querySchema.parse(request.query);
  const found = useCaseWithProjectId(state, usecaseId);
  if (found === undefined) {
    return reply.code(404).send(problem(404, "Use case not found"));
  }
  if (await membershipForProject(request, state, membershipStore, found.projectId) === undefined) {
    return reply.code(401).send(
      problem(401, "Authentication required", {}, [
        {
          command: "vspec login",
          reason: "Authenticate before fetching private specs."
        },
        {
          command: "vspec api-key create --scopes read",
          reason: "Create a read-scoped key for non-interactive agents."
        }
      ])
    );
  }
  if (found.usecase.archived_at !== null) {
    return reply.code(404).send(
      problem(404, "Use case not found", {}, [
        {
          command: "vspec usecase list --status=",
          reason: "List visible use cases, including archived ones when authorized."
        }
      ])
    );
  }
  if (query.format !== "agent") {
    return reply.send({ usecase: found.usecase });
  }
  const session = activeSession(state, query.session);
  const pinned = session?.pinned_revisions?.[found.usecase.id];
  const revision = pinned ?? resolveRevision(state, found.usecase, query.revision);
  if (revision === undefined) {
    return reply.code(404).send(
      problem(404, "Revision not found", { revision: query.revision }, [
        {
          command: `vspec history ${found.usecase.key}`,
          reason: "Find a valid revision for this use case."
        }
      ])
    );
  }
  const warnings = pinned !== undefined && query.revision !== undefined && query.revision !== pinned
    ? [{
        type: "REVISION_OVERRIDDEN_BY_SESSION",
        message: "Requested revision was ignored because the active session pins this use case."
      }]
    : session !== undefined && pinned === undefined
      ? [{
          type: "UNPINNED_SESSION_READ",
          message: "Session does not pin this use case; concurrent edits may change future reads."
        }]
    : [];
  return reply.send(await agentEnvelope(
    request,
    state,
    found.projectId,
    found.usecase,
    revision,
    session?.id ?? null,
    warnings,
    actorStore,
    projectStore
  ));
}

async function agentEnvelope(
  request: FastifyRequest,
  state: SignupState,
  projectId: string,
  usecase: StoredUseCase,
  revision: string,
  sessionId: null | string,
  warnings: Array<{ message: string; type: string }>,
  actorStore: ActorStore,
  projectStore: ProjectStore
) {
  const project = await projectStore.findProjectById(projectId);
  return {
    context: {
      branch: "main",
      project_key: project?.key ?? "",
      request_id: requestId(request),
      revision,
      session_id: sessionId
    },
    data: await agentData(state, projectId, usecase, actorStore),
    format_version: 1,
    suggested_next_actions: suggestedActions(usecase, warnings),
    warnings
  };
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
    ...(
      warnings.some((warning) => warning.type === "UNPINNED_SESSION_READ")
        ? [{
            command: `vspec session pin ${usecase.key}`,
            reason: "Pin this use case before relying on it for edits."
          }]
        : []
    )
  ];
}

function resolveRevision(
  state: SignupState,
  usecase: StoredUseCase,
  requestedRevision: string | undefined
) {
  if (requestedRevision === undefined) {
    return usecase.current_revision_id;
  }
  const exists = (state.revisionsByEntityId.get(usecase.id) ?? [])
    .some((revision) => revision.id === requestedRevision);
  return exists ? requestedRevision : undefined;
}

function activeSession(state: SignupState, sessionId: string | undefined) {
  if (sessionId === undefined) {
    return undefined;
  }
  const session = state.workSessionsById.get(sessionId);
  return session?.status === "ACTIVE" ? session : undefined;
}

async function agentData(
  state: SignupState,
  projectId: string,
  usecase: StoredUseCase,
  actorStore: ActorStore
) {
  return {
    primary_actor: {
      name: await actorName(actorStore, projectId, usecase.primary_actor_id)
    },
    scenarios: await Promise.all(
      (state.scenariosByUseCaseId.get(usecase.id) ?? []).map(async (scenario) => ({
        id: scenario.id,
        steps: await Promise.all(
          (state.stepsByScenarioId.get(scenario.id) ?? []).map(async (step) => ({
            action: step.action,
            actor: await actorName(actorStore, projectId, step.actor_id),
            step_number: step.step_number
          }))
        ),
        type: scenario.type
      }))
    ),
    stakeholder_interests: (state.stakeholderInterestsByUseCaseId.get(usecase.id) ?? [])
      .map((interest) => ({
        interest: interest.interest,
        stakeholder: stakeholderName(state, projectId, interest.stakeholder_id)
      })),
    title: usecase.title,
    usecase: { id: usecase.id, key: usecase.key }
  };
}

async function actorName(actorStore: ActorStore, projectId: string, actorId: string) {
  return (await actorStore.findActorById(projectId, actorId))?.name ?? "System";
}

function stakeholderName(state: SignupState, projectId: string, stakeholderId: string) {
  return (state.stakeholdersByProjectId.get(projectId) ?? [])
    .find((stakeholder) => stakeholder.id === stakeholderId)?.name ?? "";
}

function requestId(request: FastifyRequest) {
  const header = request.headers["x-vspec-request-id"];
  return typeof header === "string" ? header : randomUUID();
}
