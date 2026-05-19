import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { membershipForProject } from "./membership-support.js";
import {
  activeStakeholderNamed,
  existingInterestForStakeholder,
  interestsWithStakeholders,
  missingRoleHint,
  unresolvedStakeholderProblem,
  usecaseIdFrom
} from "./stakeholder-interest-support.js";
import { problem } from "./signup-support.js";
import type {
  SignupState,
  StoredStakeholderInterest
} from "./signup-types.js";
import type { MembershipStore } from "../ports/membership-store.js";
import type { UseCaseStore } from "../ports/usecase-store.js";

const interestRequestSchema = z.object({
  interest: z.string().min(1),
  protection_mechanism: z.string().default(""),
  stakeholder: z.string().min(1)
});

export function registerStakeholderInterestRoutes(
  app: FastifyInstance,
  state: SignupState,
  membershipStore: MembershipStore,
  useCaseStore: UseCaseStore
) {
  app.post("/v1/usecases/:usecaseId/stakeholder-interests", (request, reply) =>
    addStakeholderInterest(request, reply, state, membershipStore, useCaseStore)
  );
  app.delete(
    "/v1/usecases/:usecaseId/stakeholder-interests/:stakeholderInterestId",
    (request, reply) =>
      removeStakeholderInterest(request, reply, state, membershipStore, useCaseStore)
  );
}

async function addStakeholderInterest(
  request: FastifyRequest,
  reply: FastifyReply,
  state: SignupState,
  membershipStore: MembershipStore,
  useCaseStore: UseCaseStore
) {
  const found = await useCaseStore.findUseCaseWithProject(usecaseIdFrom(request.params));
  if (found === undefined) {
    return reply.code(404).send(problem(404, "Use case not found"));
  }
  if (await membershipForProject(request, state, membershipStore, found.projectId) === undefined) {
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
    return reply.code(422).send(
      unresolvedStakeholderProblem(state, found.projectId, parsed.data.stakeholder)
    );
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

async function removeStakeholderInterest(
  request: FastifyRequest,
  reply: FastifyReply,
  state: SignupState,
  membershipStore: MembershipStore,
  useCaseStore: UseCaseStore
) {
  const params = z
    .object({
      stakeholderInterestId: z.string().min(1),
      usecaseId: z.string().min(1)
    })
    .parse(request.params);
  const found = await useCaseStore.findUseCaseWithProject(params.usecaseId);
  if (found === undefined) {
    return reply.code(404).send(problem(404, "Use case not found"));
  }
  if (await membershipForProject(request, state, membershipStore, found.projectId) === undefined) {
    return reply.code(403).send(problem(403, "Contact the workspace owner for access"));
  }
  const interests = state.stakeholderInterestsByUseCaseId.get(found.usecase.id) ?? [];
  const removed = interests.find((interest) => interest.id === params.stakeholderInterestId);
  if (removed === undefined) {
    return reply.code(404).send(problem(404, "Stakeholder interest not found"));
  }
  state.stakeholderInterestsByUseCaseId.set(
    found.usecase.id,
    interests.filter((interest) => interest.id !== removed.id)
  );
  const revision = {
    id: randomUUID(),
    entity_type: "USECASE" as const,
    entity_id: found.usecase.id,
    version_number: (state.revisionsByEntityId.get(found.usecase.id) ?? []).length + 1,
    snapshot: { ...found.usecase },
    change_summary: `Removed stakeholder interest ${removed.id}`,
    severity: "BREAKING" as const
  };
  state.revisionsByEntityId.set(found.usecase.id, [
    ...(state.revisionsByEntityId.get(found.usecase.id) ?? []),
    revision
  ]);

  const remaining = interestsWithStakeholders(state, found.usecase.id, found.projectId);
  return reply.send({
    removed_stakeholder_interest_id: removed.id,
    revision,
    stakeholder_interests: remaining,
    ...(remaining.length === 0
      ? {
          warnings: [
            {
              type: "NO_STAKEHOLDER_INTERESTS",
              message: "Use case cannot leave DRAFT until an interest is added."
            }
          ]
        }
      : {})
  });
}
