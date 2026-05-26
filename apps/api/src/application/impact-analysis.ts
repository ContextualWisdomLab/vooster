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

  const revisions = await deps.revisionStore.listRevisions(found.usecase.id);
  const revision = revisionById(revisions, input.baseRevision);
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
    parentRevision(revisions, revision),
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

function revisionById(
  revisions: StoredRevision[],
  revisionId: string
): StoredRevision | undefined {
  return revisions.find((revision) => revision.id === revisionId);
}

function parentRevision(
  revisions: StoredRevision[],
  revision: StoredRevision
): StoredRevision | undefined {
  if (revision.parent_revision_id !== undefined) {
    return revisionById(revisions, revision.parent_revision_id);
  }
  return revisions
    .filter((candidate) => candidate.version_number < revision.version_number)
    .sort((left, right) => right.version_number - left.version_number)[0];
}

function impactPayload(
  revision: StoredRevision,
  parent: StoredRevision | undefined,
  affectedSessions: ImpactSession[],
  inputHash: string
): ImpactPayload {
  const localSeverity = combineSeverity(
    revision.severity ?? "NON_BREAKING",
    invocationSeverity(parent?.snapshot, revision.snapshot)
  );

  return {
    affected_branches: [],
    affected_sessions: affectedSessions,
    affected_tests: [],
    confidence: 1,
    input_hash: inputHash,
    severity: affectedSessions.length > 0 ? "BREAKING" : localSeverity
  };
}

function invocationSeverity(
  from: StoredRevision["snapshot"] | undefined,
  to: StoredRevision["snapshot"]
): ImpactPayload["severity"] | undefined {
  const fromSteps = invocationSteps(from);
  const toSteps = invocationSteps(to);
  if (fromSteps.size === 0 && toSteps.size === 0) {
    return undefined;
  }

  let hasAddedInvocation = false;
  for (const key of new Set([...fromSteps.keys(), ...toSteps.keys()])) {
    const previous = fromSteps.get(key) ?? new Set<string>();
    const next = toSteps.get(key) ?? new Set<string>();
    if ([...previous].some((invoke) => !next.has(invoke))) {
      return "BREAKING";
    }
    if ([...next].some((invoke) => !previous.has(invoke))) {
      hasAddedInvocation = true;
    }
  }

  return hasAddedInvocation ? "NON_BREAKING" : undefined;
}

function invocationSteps(
  snapshot: StoredRevision["snapshot"] | undefined
): Map<string, Set<string>> {
  const mainSuccess = record(snapshot)?.main_success;
  const steps = record(mainSuccess)?.steps;
  if (!Array.isArray(steps)) {
    return new Map();
  }

  return new Map(
    steps.flatMap((step, index) => {
      const data = record(step);
      if (data === undefined) {
        return [];
      }
      const invokes = data.invokes;
      return [
        [
          stepKey(data, index),
          new Set(Array.isArray(invokes) ? invokes.filter(isString) : [])
        ]
      ];
    })
  );
}

function stepKey(step: Record<string, unknown>, index: number): string {
  if (typeof step.id === "string") {
    return step.id;
  }
  if (typeof step.step_number === "number") {
    return String(step.step_number);
  }
  return String(index + 1);
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object"
    ? (value as Record<string, unknown>)
    : undefined;
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function combineSeverity(
  base: ImpactPayload["severity"],
  candidate: ImpactPayload["severity"] | undefined
): ImpactPayload["severity"] {
  if (candidate === undefined) {
    return base;
  }
  return severityRank(candidate) > severityRank(base) ? candidate : base;
}

function severityRank(severity: ImpactPayload["severity"]): number {
  return { BREAKING: 3, COSMETIC: 1, NON_BREAKING: 2 }[severity];
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
