import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { syncPullResponseSchema } from "@vooster/contracts";
import { pullSyncFiles, pushSyncFiles } from "../application/sync-files.js";
import { authenticatedUserId } from "./session-support.js";
import { problem } from "./signup-support.js";
import { parseFileErrors, parseFilesProblem } from "./sync-markdown.js";
import {
  projectIdFrom,
  pullSchema,
  pushSchema,
  syncFileInput
} from "./sync-route-support.js";
import { sendSyncPushResult, syncAccessProblem } from "./sync-results.js";
import type { SignupState } from "./signup-types.js";
import type { ActorStore } from "../ports/actor-store.js";
import type { BranchStore } from "../ports/branch-store.js";
import type { MembershipStore } from "../ports/membership-store.js";
import type { ProjectStore } from "../ports/project-store.js";
import type { RevisionStore } from "../ports/revision-store.js";
import type { ScenarioStore } from "../ports/scenario-store.js";
import type { StakeholderInterestStore } from "../ports/stakeholder-interest-store.js";
import type { StakeholderStore } from "../ports/stakeholder-store.js";
import type { StepStore } from "../ports/step-store.js";
import type { UseCaseStore } from "../ports/usecase-store.js";

type SyncRouteDeps = {
  actorStore: ActorStore;
  branchStore: BranchStore;
  membershipStore: MembershipStore;
  projectStore: ProjectStore;
  revisionStore: RevisionStore;
  scenarioStore: ScenarioStore;
  stakeholderInterestStore: StakeholderInterestStore;
  stakeholderStore: StakeholderStore;
  state: SignupState;
  stepStore: StepStore;
  useCaseStore: UseCaseStore;
};

export function registerSyncRoutes(
  app: FastifyInstance,
  state: SignupState,
  actorStore: ActorStore,
  branchStore: BranchStore,
  membershipStore: MembershipStore,
  projectStore: ProjectStore,
  revisionStore: RevisionStore,
  scenarioStore: ScenarioStore,
  stakeholderInterestStore: StakeholderInterestStore,
  stakeholderStore: StakeholderStore,
  stepStore: StepStore,
  useCaseStore: UseCaseStore
) {
  const deps = {
    actorStore,
    branchStore,
    membershipStore,
    projectStore,
    revisionStore,
    scenarioStore,
    stakeholderInterestStore,
    stakeholderStore,
    state,
    stepStore,
    useCaseStore
  };

  app.post("/v1/projects/:projectId/sync/pull", (request, reply) =>
    pullFiles(request, reply, deps)
  );
  app.post("/v1/projects/:projectId/sync/push", (request, reply) =>
    pushFiles(request, reply, deps)
  );
}

async function pullFiles(
  request: FastifyRequest,
  reply: FastifyReply,
  deps: SyncRouteDeps
) {
  const projectId = projectIdFrom(request.params);
  const parsed = pullSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.code(400).send(problem(400, "Invalid sync pull request"));
  }
  const result = await pullSyncFiles(
    {
      actorStore: deps.actorStore,
      membershipStore: deps.membershipStore,
      scenarioStore: deps.scenarioStore,
      stakeholderInterestStore: deps.stakeholderInterestStore,
      stakeholderStore: deps.stakeholderStore,
      stepStore: deps.stepStore,
      useCaseStore: deps.useCaseStore
    },
    {
      projectId,
      userId: authenticatedUserId(request.headers.cookie, deps.state.sessionsByToken)
    }
  );
  return result.status === "FORBIDDEN"
    ? reply.code(403).send(syncAccessProblem())
    : reply.send(
        syncPullResponseSchema.parse({ cursor: result.cursor, files: result.files })
      );
}

async function pushFiles(
  request: FastifyRequest,
  reply: FastifyReply,
  deps: SyncRouteDeps
) {
  const projectId = projectIdFrom(request.params);
  const parsed = pushSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.code(400).send(problem(400, "Invalid sync push request"));
  }
  const parseErrors = parsed.data.files.flatMap(parseFileErrors);
  if (parseErrors.length > 0) {
    return reply.code(400).send(parseFilesProblem(parseErrors));
  }
  return sendSyncPushResult(
    reply,
    await pushSyncFiles(
      {
        actorStore: deps.actorStore,
        branchStore: deps.branchStore,
        membershipStore: deps.membershipStore,
        projectStore: deps.projectStore,
        revisionStore: deps.revisionStore,
        scenarioStore: deps.scenarioStore,
        stakeholderInterestStore: deps.stakeholderInterestStore,
        stakeholderStore: deps.stakeholderStore,
        stepStore: deps.stepStore,
        useCaseStore: deps.useCaseStore
      },
      {
        dryRun: parsed.data.dry_run,
        files: parsed.data.files.map(syncFileInput),
        projectId,
        simulateNetworkFailure: parsed.data.simulate_network_failure,
        userId: authenticatedUserId(request.headers.cookie, deps.state.sessionsByToken)
      }
    )
  );
}
