import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import {
  diagnoseProject,
  diagnoseUseCase,
  type DoctorResult
} from "../application/doctor.js";
import type { MembershipStore } from "../ports/membership-store.js";
import type { ProjectStore } from "../ports/project-store.js";
import type { ScenarioStore } from "../ports/scenario-store.js";
import type { StakeholderInterestStore } from "../ports/stakeholder-interest-store.js";
import type { StepStore } from "../ports/step-store.js";
import type { UseCaseStore } from "../ports/usecase-store.js";
import { authenticatedUserId } from "./session-support.js";
import { problem } from "./signup-support.js";
import type { SignupState } from "./signup-types.js";

const doctorQuery = z.object({
  project_id: z.string().min(1).optional(),
  usecase: z.string().min(1).optional()
});

type DoctorRouteDeps = {
  membershipStore: MembershipStore;
  projectStore: ProjectStore;
  scenarioStore: ScenarioStore;
  stakeholderInterestStore: StakeholderInterestStore;
  stepStore: StepStore;
  useCaseStore: UseCaseStore;
};

export function registerDoctorRoutes(
  app: FastifyInstance,
  state: SignupState,
  deps: DoctorRouteDeps
) {
  app.get("/v1/doctor", (request, reply) => diagnose(request, reply, state, deps));
}

async function diagnose(
  request: FastifyRequest,
  reply: FastifyReply,
  state: SignupState,
  deps: DoctorRouteDeps
) {
  const parsed = doctorQuery.safeParse(request.query);
  if (!parsed.success || bothOrNeither(parsed.data.project_id, parsed.data.usecase)) {
    return reply
      .code(400)
      .send(problem(400, "Provide exactly one of project_id or usecase"));
  }

  const userId = authenticatedUserId(request.headers.cookie, state.sessionsByToken);
  if (userId === undefined) {
    return reply.code(403).send(problem(403, "Not authorized to run doctor"));
  }

  if (parsed.data.usecase !== undefined) {
    const found = await deps.useCaseStore.findUseCaseWithProject(parsed.data.usecase);
    if (found === undefined) {
      return reply.code(404).send(problem(404, "Use case not found"));
    }
    if (
      (await deps.membershipStore.membershipForProject(found.projectId, userId)) ===
      undefined
    ) {
      return reply.code(403).send(problem(403, "Not authorized to run doctor"));
    }
    const result = await diagnoseUseCase(deps, parsed.data.usecase);
    return sendDoctorResult(reply, result);
  }

  const projectId = parsed.data.project_id;
  if (projectId === undefined) {
    return reply.code(400).send(problem(400, "Provide project_id"));
  }
  if (
    (await deps.membershipStore.membershipForProject(projectId, userId)) === undefined
  ) {
    return reply.code(403).send(problem(403, "Not authorized to run doctor"));
  }
  const result = await diagnoseProject(deps, projectId);
  return sendDoctorResult(reply, result);
}

function sendDoctorResult(reply: FastifyReply, result: DoctorResult) {
  switch (result.status) {
    case "project_not_found":
      return reply.code(404).send(problem(404, "Project not found"));
    case "usecase_not_found":
      return reply.code(404).send(problem(404, "Use case not found"));
    default:
      return reply.send(result);
  }
}

function bothOrNeither(projectId: string | undefined, usecaseId: string | undefined) {
  return (
    (projectId === undefined && usecaseId === undefined) ||
    (projectId !== undefined && usecaseId !== undefined)
  );
}
