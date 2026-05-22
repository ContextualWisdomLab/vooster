import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { pullSyncFiles, pushSyncFiles } from "../application/sync-files.js";
import { authenticatedUserId } from "./session-support.js";
import { problem } from "./signup-support.js";
import { parseFileErrors, parseFilesProblem } from "./sync-markdown.js";
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

const pullSchema = z.object({
  branch: z.string().default("main"),
  since: z.string().optional()
});
const pushSchema = z.object({
  branch: z.string().default("main"),
  dry_run: z.boolean().default(false),
  files: z
    .array(
      z.object({
        base_revision: z.string().min(1),
        content: z.string().min(1),
        path: z.string().min(1)
      })
    )
    .min(1),
  simulate_network_failure: z.boolean().default(false)
});

type PushFile = z.infer<typeof pushSchema>["files"][number];

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
  app.post("/v1/projects/:projectId/sync/pull", (request, reply) =>
    pullFiles(
      request,
      reply,
      state,
      actorStore,
      membershipStore,
      scenarioStore,
      stakeholderInterestStore,
      stakeholderStore,
      stepStore,
      useCaseStore
    )
  );
  app.post("/v1/projects/:projectId/sync/push", (request, reply) =>
    pushFiles(
      request,
      reply,
      state,
      actorStore,
      branchStore,
      membershipStore,
      projectStore,
      revisionStore,
      scenarioStore,
      stakeholderInterestStore,
      stakeholderStore,
      stepStore,
      useCaseStore
    )
  );
}

async function pullFiles(
  request: FastifyRequest,
  reply: FastifyReply,
  state: SignupState,
  actorStore: ActorStore,
  membershipStore: MembershipStore,
  scenarioStore: ScenarioStore,
  stakeholderInterestStore: StakeholderInterestStore,
  stakeholderStore: StakeholderStore,
  stepStore: StepStore,
  useCaseStore: UseCaseStore
) {
  const projectId = projectIdFrom(request.params);
  const parsed = pullSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.code(400).send(problem(400, "Invalid sync pull request"));
  }
  const result = await pullSyncFiles(
    {
      actorStore,
      membershipStore,
      scenarioStore,
      stakeholderInterestStore,
      stakeholderStore,
      stepStore,
      useCaseStore
    },
    {
      projectId,
      userId: authenticatedUserId(request.headers.cookie, state.sessionsByToken)
    }
  );
  return result.status === "FORBIDDEN"
    ? reply.code(403).send(syncAccessProblem())
    : reply.send({ cursor: result.cursor, files: result.files });
}

async function pushFiles(
  request: FastifyRequest,
  reply: FastifyReply,
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
        branchStore,
        actorStore,
        membershipStore,
        projectStore,
        revisionStore,
        scenarioStore,
        stakeholderInterestStore,
        stakeholderStore,
        stepStore,
        useCaseStore
      },
      {
        dryRun: parsed.data.dry_run,
        files: parsed.data.files.map(syncFileInput),
        projectId,
        simulateNetworkFailure: parsed.data.simulate_network_failure,
        userId: authenticatedUserId(request.headers.cookie, state.sessionsByToken)
      }
    )
  );
}

function projectIdFrom(params: unknown) {
  return z.object({ projectId: z.string().min(1) }).parse(params).projectId;
}

function syncFileInput(file: PushFile) {
  return {
    baseRevision: file.base_revision,
    content: file.content,
    path: file.path
  };
}
