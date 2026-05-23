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
import { membershipForProject } from "./membership-support.js";
import { problem } from "./signup-support.js";
import type { SignupState } from "./signup-types.js";

const doctorQuery = z.object({
  project_id: z.string().min(1).optional(),
  usecase_id: z.string().min(1).optional()
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
  if (
    !parsed.success ||
    bothOrNeither(parsed.data.project_id, parsed.data.usecase_id)
  ) {
    return reply
      .code(400)
      .send(problem(400, "Provide exactly one of project_id or usecase_id"));
  }

  if (parsed.data.usecase_id !== undefined) {
    const result = await diagnoseUseCase(deps, parsed.data.usecase_id);
    return sendDoctorResult(request, reply, state, deps, result);
  }

  const projectId = parsed.data.project_id;
  if (projectId === undefined) {
    return reply.code(400).send(problem(400, "Provide project_id"));
  }
  const result = await diagnoseProject(deps, projectId);
  return sendDoctorResult(request, reply, state, deps, result);
}

async function sendDoctorResult(
  request: FastifyRequest,
  reply: FastifyReply,
  state: SignupState,
  deps: Pick<DoctorRouteDeps, "membershipStore">,
  result: DoctorResult
) {
  switch (result.status) {
    case "PROJECT_NOT_FOUND":
      return reply.code(404).send(problem(404, "Project not found"));
    case "USECASE_NOT_FOUND":
      return reply.code(404).send(problem(404, "Use case not found"));
    default:
      if (
        (await membershipForProject(
          request,
          state,
          deps.membershipStore,
          result.scope.project_id
        )) === undefined
      ) {
        return reply.code(403).send(problem(403, "Not authorized to run doctor"));
      }
      return reply.send(result);
  }
}

function bothOrNeither(projectId: string | undefined, usecaseId: string | undefined) {
  return (
    (projectId === undefined && usecaseId === undefined) ||
    (projectId !== undefined && usecaseId !== undefined)
  );
}
