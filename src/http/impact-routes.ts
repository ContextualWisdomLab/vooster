import { createHash, randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { previewSpecChange } from "./change-preview-routes.js";
import { membershipForProject } from "./membership-support.js";
import { problem } from "./signup-support.js";
import type { SignupState, StoredRevision, StoredUseCase } from "./signup-types.js";
import type { LockStore } from "../ports/lock-store.js";
import type { MembershipStore } from "../ports/membership-store.js";
import type { RevisionStore } from "../ports/revision-store.js";
import type { UseCaseStore } from "../ports/usecase-store.js";
import type { WorkSessionStore } from "../ports/work-session-store.js";

type ImpactPayload = {
  affected_branches: string[];
  affected_sessions: Awaited<ReturnType<typeof affectedActiveSessions>>;
  affected_tests: string[];
  confidence: number;
  input_hash: string;
  severity: "BREAKING" | "COSMETIC" | "NON_BREAKING";
};

const impactCaches = new WeakMap<SignupState, Map<string, ImpactPayload>>();
const previewSchema = z.object({
  base_revision: z.string().min(1),
  entity_id: z.string().min(1),
  entity_type: z.literal("USECASE"),
  proposed_change_content: z.string().optional(),
  proposed_change_path: z.string().optional()
});

export function registerImpactRoutes(
  app: FastifyInstance,
  state: SignupState,
  lockStore: LockStore,
  membershipStore: MembershipStore,
  revisionStore: RevisionStore,
  workSessionStore: WorkSessionStore,
  useCaseStore: UseCaseStore
) {
  app.post("/v1/changes/preview", async (request, reply) => {
    if (
      await previewSpecChange(
        request,
        reply,
        state,
        lockStore,
        membershipStore,
        revisionStore,
        workSessionStore,
        useCaseStore
      )
    ) {
      return undefined;
    }
    return previewImpact(
      request,
      reply,
      state,
      membershipStore,
      revisionStore,
      workSessionStore,
      useCaseStore
    );
  });
}

async function previewImpact(
  request: FastifyRequest,
  reply: FastifyReply,
  state: SignupState,
  membershipStore: MembershipStore,
  revisionStore: RevisionStore,
  workSessionStore: WorkSessionStore,
  useCaseStore: UseCaseStore
) {
  const parsed = previewSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.code(400).send(problem(400, "Invalid impact preview request"));
  }
  const found = await useCaseStore.findUseCaseWithProject(parsed.data.entity_id);
  if (found === undefined) {
    return reply.code(404).send(problem(404, "Use case not found"));
  }
  if (await membershipForProject(request, state, membershipStore, found.projectId) === undefined) {
    return reply.code(403).send(impactAccessProblem());
  }
  if (parsed.data.proposed_change_content !== undefined) {
    return reply
      .code(400)
      .send(parseProposedChangeProblem(parsed.data.proposed_change_path ?? "<inline>"));
  }
  if (parsed.data.proposed_change_path !== undefined) {
    return reply
      .code(400)
      .send(missingProposedChangeProblem(found.usecase, parsed.data.proposed_change_path));
  }
  const revision = await revisionById(revisionStore, found.usecase.id, parsed.data.base_revision);
  if (revision === undefined) {
    return reply.code(404).send(problem(404, "Revision not found"));
  }

  const affectedSessions = await affectedActiveSessions(workSessionStore, found.usecase.id);
  const inputHash = impactHash(revision.id, revision.snapshot);
  const previewId = randomUUID();
  const cached = cacheFor(state).get(inputHash);
  if (cached !== undefined) {
    return reply.send({
      cached: true,
      impact: cached,
      preview_id: previewId,
      suggested_next_actions: nextActions(found.usecase, previewId)
    });
  }
  const impact = impactPayload(revision, affectedSessions, inputHash);
  cacheFor(state).set(inputHash, impact);
  return reply.send({
    cached: false,
    impact,
    preview_id: previewId,
    suggested_next_actions: nextActions(found.usecase, previewId)
  });
}

function revisionById(
  revisionStore: RevisionStore,
  usecaseId: string,
  revisionId: string
): Promise<StoredRevision | undefined> {
  return revisionStore.listRevisions(usecaseId)
    .then((revisions) => revisions.find((revision) => revision.id === revisionId));
}

function cacheFor(state: SignupState) {
  const existing = impactCaches.get(state);
  if (existing !== undefined) {
    return existing;
  }
  const created = new Map<string, ImpactPayload>();
  impactCaches.set(state, created);
  return created;
}

function impactPayload(
  revision: StoredRevision,
  affectedSessions: Awaited<ReturnType<typeof affectedActiveSessions>>,
  inputHash: string
): ImpactPayload {
  return {
    affected_branches: [],
    affected_sessions: affectedSessions,
    affected_tests: [],
    confidence: 1,
    input_hash: inputHash,
    severity: affectedSessions.length > 0 ? "BREAKING" : revision.severity ?? "NON_BREAKING"
  };
}

function impactHash(revisionId: string, snapshot: StoredRevision["snapshot"]) {
  return createHash("sha256")
    .update(JSON.stringify({ revisionId, snapshot }))
    .digest("hex");
}

async function affectedActiveSessions(workSessionStore: WorkSessionStore, usecaseId: string) {
  return (await workSessionStore.listWorkSessionsForUseCase(usecaseId))
    .filter((session) => session.status === "ACTIVE")
    .map((session) => ({
      agent_type: session.agent_type,
      id: session.id,
      owner: session.user_id,
      pinned_revision: session.pinned_revisions?.[usecaseId]
    }));
}

function missingProposedChangeProblem(usecase: StoredUseCase, path: string) {
  return problem(
    400,
    "Proposed change file is not readable",
    { path },
    [
      {
        command: "vspec impact --proposed-change <path>",
        reason: "Verify the proposed-change path and retry."
      },
      {
        command: `vspec impact ${usecase.key}`,
        reason: "Rerun without a proposed-change file to analyze the current head."
      }
    ]
  );
}

function parseProposedChangeProblem(path: string) {
  return problem(
    400,
    "Proposed change parse failed",
    { parser_error: "Missing frontmatter" },
    [
      {
        command: `vspec doctor ${path}`,
        reason: "Validate the proposed-change file format."
      }
    ]
  );
}

function impactAccessProblem() {
  return problem(
    403,
    "Not authorized to preview impact",
    {},
    [
      {
        command: "vspec login",
        reason: "Authenticate with an account that has project access."
      },
      {
        command: "vspec member set-role",
        reason: "Ask a workspace owner for read access."
      }
    ]
  );
}

function nextActions(usecase: StoredUseCase, previewId: string) {
  return [
    {
      command: `vspec lock ${usecase.key}`,
      reason: "Lock the use case before applying a risky change."
    },
    {
      command: "vspec session list --status=active",
      reason: "Coordinate with affected active sessions."
    },
    {
      command: `vspec changes commit ${previewId}`,
      reason: "Commit the previewed change after review."
    }
  ];
}
