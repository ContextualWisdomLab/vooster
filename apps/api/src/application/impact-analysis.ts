import { createHash, randomUUID } from "node:crypto";
import type {
  StoredRevision,
  StoredUseCase,
  StoredWorkSession
} from "../domain/entities/index.js";
import type { MembershipStore } from "../ports/membership-store.js";
import type { RevisionStore } from "../ports/revision-store.js";
import type { UseCaseStore } from "../ports/usecase-store.js";
import type { WorkSessionStore } from "../ports/work-session-store.js";

export type ImpactPayload = {
  affected_branches: string[];
  affected_sessions: ImpactSession[];
  affected_tests: string[];
  confidence: number;
  input_hash: string;
  severity: "BREAKING" | "COSMETIC" | "NON_BREAKING";
};

export type ImpactSession = {
  agent_type: StoredWorkSession["agent_type"];
  id: string;
  owner: string | undefined;
  pinned_revision: string | undefined;
};

export type ImpactDeps = {
  cache: Map<string, ImpactPayload>;
  hashFactory?: (revision: StoredRevision) => string;
  idFactory?: () => string;
  membershipStore: MembershipStore;
  revisionStore: RevisionStore;
  useCaseStore: UseCaseStore;
  workSessionStore: WorkSessionStore;
};

export type ImpactInput = {
  baseRevision: string;
  entityId: string;
  proposedChangeContent: string | undefined;
  proposedChangePath: string | undefined;
  userId: string | undefined;
};

export type ImpactResult =
  | { status: "NOT_FOUND" }
  | { status: "ACCESS_DENIED" }
  | { path: string; status: "PROPOSED_CHANGE_PARSE_FAILED" }
  | { path: string; status: "PROPOSED_CHANGE_NOT_READABLE"; usecase: StoredUseCase }
  | { status: "REVISION_NOT_FOUND" }
  | {
      cached: boolean;
      impact: ImpactPayload;
      nextActions: Array<{ command: string; reason: string }>;
      previewId: string;
      status: "PREVIEWED";
    };

export async function previewImpact(
  deps: ImpactDeps,
  input: ImpactInput
): Promise<ImpactResult> {
  const found = await deps.useCaseStore.findUseCaseWithProject(input.entityId);
  if (found === undefined) {
    return { status: "NOT_FOUND" };
  }
  if (
    input.userId === undefined ||
    (await deps.membershipStore.membershipForProject(found.projectId, input.userId)) ===
      undefined
  ) {
    return { status: "ACCESS_DENIED" };
  }
  if (input.proposedChangeContent !== undefined) {
    return {
      path: input.proposedChangePath ?? "<inline>",
      status: "PROPOSED_CHANGE_PARSE_FAILED"
    };
  }
  if (input.proposedChangePath !== undefined) {
    return {
      path: input.proposedChangePath,
      status: "PROPOSED_CHANGE_NOT_READABLE",
      usecase: found.usecase
    };
  }

  const revision = await revisionById(
    deps.revisionStore,
    found.usecase.id,
    input.baseRevision
  );
  if (revision === undefined) {
    return { status: "REVISION_NOT_FOUND" };
  }

  const inputHash = hash(deps, revision);
  const previewId = id(deps);
  const cached = deps.cache.get(inputHash);
  if (cached !== undefined) {
    return {
      cached: true,
      impact: cached,
      nextActions: nextActions(found.usecase, previewId),
      previewId,
      status: "PREVIEWED"
    };
  }

  const impact = impactPayload(
    revision,
    await affectedActiveSessions(deps.workSessionStore, found.usecase.id),
    inputHash
  );
  deps.cache.set(inputHash, impact);
  return {
    cached: false,
    impact,
    nextActions: nextActions(found.usecase, previewId),
    previewId,
    status: "PREVIEWED"
  };
}

async function revisionById(
  revisionStore: RevisionStore,
  usecaseId: string,
  revisionId: string
): Promise<StoredRevision | undefined> {
  return (await revisionStore.listRevisions(usecaseId)).find(
    (revision) => revision.id === revisionId
  );
}

function impactPayload(
  revision: StoredRevision,
  affectedSessions: ImpactSession[],
  inputHash: string
): ImpactPayload {
  return {
    affected_branches: [],
    affected_sessions: affectedSessions,
    affected_tests: [],
    confidence: 1,
    input_hash: inputHash,
    severity:
      affectedSessions.length > 0 ? "BREAKING" : (revision.severity ?? "NON_BREAKING")
  };
}

async function affectedActiveSessions(
  workSessionStore: WorkSessionStore,
  usecaseId: string
): Promise<ImpactSession[]> {
  return (await workSessionStore.listWorkSessionsForUseCase(usecaseId))
    .filter((session) => session.status === "ACTIVE")
    .map((session) => ({
      agent_type: session.agent_type,
      id: session.id,
      owner: session.user_id,
      pinned_revision: session.pinned_revisions?.[usecaseId]
    }));
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
      command: `vspec change commit --preview-id ${previewId}`,
      reason: "Commit the previewed change after review."
    }
  ];
}

function hash(deps: ImpactDeps, revision: StoredRevision) {
  return (deps.hashFactory ?? impactHash)(revision);
}

function impactHash(revision: StoredRevision) {
  return createHash("sha256")
    .update(JSON.stringify({ revisionId: revision.id, snapshot: revision.snapshot }))
    .digest("hex");
}

function id(deps: ImpactDeps): string {
  return (deps.idFactory ?? randomUUID)();
}
