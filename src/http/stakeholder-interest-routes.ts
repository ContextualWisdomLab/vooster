import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { authenticatedUserId } from "./session-support.js";
import { problem } from "./signup-support.js";
import { useCaseWithProjectId } from "./usecase-support.js";
import type {
  SignupState,
  StoredMembership,
  StoredStakeholder,
  StoredStakeholderInterest
} from "./signup-types.js";

const interestRequestSchema = z.object({
  interest: z.string().min(1),
  protection_mechanism: z.string().default(""),
  stakeholder: z.string().min(1)
});

export function registerStakeholderInterestRoutes(
  app: FastifyInstance,
  state: SignupState
) {
  app.post("/v1/usecases/:usecaseId/stakeholder-interests", (request, reply) =>
    addStakeholderInterest(request, reply, state)
  );
}

function addStakeholderInterest(
  request: FastifyRequest,
  reply: FastifyReply,
  state: SignupState
) {
  const found = useCaseWithProjectId(state, usecaseIdFrom(request.params));
  if (found === undefined) {
    return reply.code(404).send(problem(404, "Use case not found"));
  }
  if (membershipForProject(request, state, found.projectId) === undefined) {
    return reply.code(403).send(problem(403, "Contact the workspace owner for access"));
  }
  const parsed = interestRequestSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.code(400).send(problem(400, "Invalid stakeholder interest request"));
  }

  const stakeholder = activeStakeholderNamed(
    state,
    found.projectId,
    parsed.data.stakeholder
  );
  if (stakeholder === undefined) {
    return reply.code(422).send(problem(422, "Stakeholder is not available"));
  }
  const existing = existingInterestForStakeholder(state, found.usecase.id, stakeholder.id);
  if (existing !== undefined) {
    return reply.code(409).send(
      problem(
        409,
        "Stakeholder interest already exists",
        { existing_interest: existing.interest },
        [
          {
            command: "vspec usecase set --field stakeholder-interest",
            reason: "Edit the existing stakeholder interest."
          }
        ]
      )
    );
  }

  const stakeholderInterest: StoredStakeholderInterest = {
    id: randomUUID(),
    usecase_id: found.usecase.id,
    stakeholder_id: stakeholder.id,
    interest: parsed.data.interest,
    protection_mechanism: parsed.data.protection_mechanism
  };
  state.stakeholderInterestsByUseCaseId.set(found.usecase.id, [
    ...(state.stakeholderInterestsByUseCaseId.get(found.usecase.id) ?? []),
    stakeholderInterest
  ]);
  const revision = {
    id: randomUUID(),
    entity_type: "USECASE" as const,
    entity_id: found.usecase.id,
    version_number: (state.revisionsByEntityId.get(found.usecase.id) ?? []).length + 1,
    snapshot: { ...found.usecase },
    change_summary: `Added stakeholder interest ${stakeholderInterest.id}`,
    severity: "NON_BREAKING" as const
  };
  state.revisionsByEntityId.set(found.usecase.id, [
    ...(state.revisionsByEntityId.get(found.usecase.id) ?? []),
    revision
  ]);

  return reply.code(201).send({
    stakeholder_interest: stakeholderInterest,
    revision,
    stakeholder_interests: interestsWithStakeholders(state, found.usecase.id, found.projectId),
    next_missing_role_hint: missingRoleHint(state, found.usecase.id, found.projectId)
  });
}

function interestsWithStakeholders(
  state: SignupState,
  usecaseId: string,
  projectId: string
) {
  return (state.stakeholderInterestsByUseCaseId.get(usecaseId) ?? []).flatMap(
    (interest) => {
      const stakeholder = stakeholderWithId(state, projectId, interest.stakeholder_id);
      return stakeholder === undefined ? [] : [{ interest, stakeholder }];
    }
  );
}

function missingRoleHint(state: SignupState, usecaseId: string, projectId: string): string {
  const hasRegulatory = interestsWithStakeholders(state, usecaseId, projectId).some(
    ({ stakeholder }) => stakeholder.type === "REGULATORY"
  );
  return hasRegulatory ? "" : "No regulatory stakeholder yet.";
}

function existingInterestForStakeholder(
  state: SignupState,
  usecaseId: string,
  stakeholderId: string
): StoredStakeholderInterest | undefined {
  return (state.stakeholderInterestsByUseCaseId.get(usecaseId) ?? []).find(
    (interest) => interest.stakeholder_id === stakeholderId
  );
}

function activeStakeholderNamed(
  state: SignupState,
  projectId: string,
  name: string
): StoredStakeholder | undefined {
  return (state.stakeholdersByProjectId.get(projectId) ?? []).find(
    (stakeholder) => stakeholder.name === name && stakeholder.archived_at === null
  );
}

function stakeholderWithId(
  state: SignupState,
  projectId: string,
  stakeholderId: string
): StoredStakeholder | undefined {
  return (state.stakeholdersByProjectId.get(projectId) ?? []).find(
    (stakeholder) => stakeholder.id === stakeholderId
  );
}

function membershipForProject(
  request: FastifyRequest,
  state: SignupState,
  projectId: string
): StoredMembership | undefined {
  const project = state.projectsById.get(projectId);
  const userId = authenticatedUserId(request.headers.cookie, state.sessionsByToken);
  if (project === undefined || userId === undefined) {
    return undefined;
  }

  return (state.membershipsByUserId.get(userId) ?? []).find(
    (membership) => membership.workspace_id === project.workspace_id
  );
}

function usecaseIdFrom(params: unknown): string {
  return z.object({ usecaseId: z.string().min(1) }).parse(params).usecaseId;
}
