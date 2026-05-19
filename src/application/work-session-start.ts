import { randomUUID } from "node:crypto";
import type {
  StoredAgentType,
  StoredSpecBranch,
  StoredUseCase,
  StoredWorkSession
} from "../http/signup-types.js";
import type { BranchStore } from "../ports/branch-store.js";
import type { LockStore } from "../ports/lock-store.js";
import type { MembershipStore } from "../ports/membership-store.js";
import type { ProjectStore } from "../ports/project-store.js";
import type { RevisionStore } from "../ports/revision-store.js";
import type { UseCaseStore } from "../ports/usecase-store.js";
import type { WorkSessionStore } from "../ports/work-session-store.js";

const knownAgentTypes = new Set<StoredAgentType>([
  "CLAUDE_CODE",
  "CODEX",
  "CURSOR",
  "HUMAN",
  "OTHER",
  "WINDSURF"
]);

type PinnedUseCases = {
  keys: string[];
  revisions: Record<string, string>;
  status: "OK";
  usecases: StoredUseCase[];
};

export type StartWorkSessionDeps = {
  branchStore: BranchStore;
  clock?: () => string;
  idFactory?: () => string;
  lockStore: LockStore;
  membershipStore: MembershipStore;
  projectStore: ProjectStore;
  revisionStore: RevisionStore;
  useCaseStore: UseCaseStore;
  workSessionStore: WorkSessionStore;
};

export type StartWorkSessionInput = {
  agentIdentifier: string;
  agentType: string;
  autoBranch: boolean;
  branchName?: string;
  intent: string;
  pins: string[];
  projectId: string;
  simulateWriteFailure?: boolean;
  userId?: string;
};

export type StartWorkSessionResult =
  | { status: "ARCHIVED_PIN"; key: string }
  | { status: "AUTO_BRANCH_COLLISION" }
  | { status: "FORBIDDEN" }
  | { status: "HARD_LOCKED"; holder: string; key: string }
  | { status: "MISSING_PIN"; key: string }
  | { status: "SEMANTIC_LOCKED"; holder: string; key: string }
  | { status: "WRITE_FAILURE" }
  | {
      branch?: StoredSpecBranch;
      pinnedKeys: string[];
      session: StoredWorkSession;
      status: "STARTED";
      warning?: { message: string; type: "UNKNOWN_AGENT_TYPE" };
    };

export async function startWorkSession(
  deps: StartWorkSessionDeps,
  input: StartWorkSessionInput
): Promise<StartWorkSessionResult> {
  if (
    input.userId === undefined ||
    await deps.membershipStore.membershipForProject(input.projectId, input.userId) ===
      undefined
  ) {
    return { status: "FORBIDDEN" };
  }

  const pinned = await resolvePins(deps, input.projectId, input.pins);
  if (pinned.status !== "OK") {
    return pinned;
  }

  if (input.autoBranch) {
    const semanticConflict = await semanticLockConflict(deps.lockStore, pinned);
    if (semanticConflict !== undefined) {
      return {
        holder: semanticConflict.holder,
        key: semanticConflict.key,
        status: "SEMANTIC_LOCKED"
      };
    }
  }

  if (input.simulateWriteFailure === true) {
    return { status: "WRITE_FAILURE" };
  }

  const session = workSession(deps, input, pinned);
  const branch = input.autoBranch
    ? await createAutoBranch(
        deps,
        input.projectId,
        input.branchName ?? `agent/${session.id}`,
        session
      )
    : undefined;
  if (branch === undefined && input.autoBranch) {
    return { status: "AUTO_BRANCH_COLLISION" };
  }

  session.branch_id = branch?.id ?? null;
  await deps.workSessionStore.saveWorkSession(session);

  return {
    branch,
    pinnedKeys: pinned.keys,
    session,
    status: "STARTED",
    warning: unknownAgentWarning(input.agentType)
  };
}

async function resolvePins(
  deps: Pick<StartWorkSessionDeps, "lockStore" | "revisionStore" | "useCaseStore">,
  projectId: string,
  keys: string[]
): Promise<
  PinnedUseCases |
  { holder: string; key: string; status: "HARD_LOCKED" } |
  { key: string; status: "ARCHIVED_PIN" | "MISSING_PIN" }
> {
  const usecases = await deps.useCaseStore.listUseCases(projectId);
  const resolved: StoredUseCase[] = [];
  for (const key of keys) {
    const usecase = usecases.find((candidate) => candidate.key === key);
    if (usecase === undefined) {
      return { key, status: "MISSING_PIN" };
    }
    if (usecase.archived_at !== null) {
      return { key, status: "ARCHIVED_PIN" };
    }
    const lock = await deps.lockStore.findLockForUseCase(usecase.id);
    if (lock?.mode === "HARD") {
      return { holder: lock.holder, key, status: "HARD_LOCKED" };
    }
    resolved.push(usecase);
  }

  return {
    keys,
    revisions: await pinnedRevisions(deps.revisionStore, resolved),
    status: "OK",
    usecases: resolved
  };
}

async function pinnedRevisions(
  revisionStore: RevisionStore,
  usecases: StoredUseCase[]
): Promise<Record<string, string>> {
  const revisions: Record<string, string> = {};
  for (const usecase of usecases) {
    revisions[usecase.id] =
      (await revisionStore.latestRevision(usecase.id))?.id ?? usecase.current_revision_id;
  }
  return revisions;
}

async function semanticLockConflict(
  lockStore: LockStore,
  pinned: PinnedUseCases
): Promise<{ holder: string; key: string } | undefined> {
  for (const usecase of pinned.usecases) {
    const lock = await lockStore.findLockForUseCase(usecase.id);
    if (lock?.mode === "SEMANTIC") {
      return { holder: lock.holder, key: usecase.key };
    }
  }

  return undefined;
}

function workSession(
  deps: Pick<StartWorkSessionDeps, "clock" | "idFactory">,
  input: StartWorkSessionInput,
  pinned: PinnedUseCases
): StoredWorkSession {
  const agentType = agentTypeFor(input.agentType);
  const now = (deps.clock ?? (() => new Date().toISOString()))();
  return {
    agent_identifier: agentType === "OTHER" ? input.agentType : input.agentIdentifier,
    agent_type: agentType,
    branch_id: null,
    id: idFrom(deps),
    intent: input.intent,
    last_activity_at: now,
    pinned_revisions: pinned.revisions,
    project_id: input.projectId,
    started_at: now,
    status: "ACTIVE",
    user_id: input.userId
  };
}

async function createAutoBranch(
  deps: Pick<StartWorkSessionDeps, "branchStore" | "idFactory" | "projectStore">,
  projectId: string,
  requestedName: string,
  session: StoredWorkSession
): Promise<StoredSpecBranch | undefined> {
  const project = await deps.projectStore.findProjectById(projectId);
  const name = await uniqueBranchName(deps, projectId, requestedName);
  if (project === undefined || name === undefined) {
    return undefined;
  }
  const branch = {
    base_branch_id: project.default_branch_id,
    id: idFrom(deps),
    name,
    owner_id: session.id,
    owner_type: "AGENT" as const,
    project_id: projectId
  };
  await deps.branchStore.saveBranch(branch);
  return branch;
}

async function uniqueBranchName(
  deps: Pick<StartWorkSessionDeps, "branchStore" | "idFactory">,
  projectId: string,
  requestedName: string
): Promise<string | undefined> {
  const existing = new Set(
    (await deps.branchStore.listBranches(projectId)).map((branch) => branch.name)
  );
  if (!existing.has(requestedName)) {
    return requestedName;
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const candidate = `${requestedName}-${idFrom(deps).replaceAll("-", "").slice(0, 6)}`;
    if (!existing.has(candidate)) {
      return candidate;
    }
  }
  return undefined;
}

function unknownAgentWarning(rawAgentType: string) {
  return knownAgentTypes.has(rawAgentType as StoredAgentType)
    ? undefined
    : {
        message: `Stored unrecognized agent_type ${rawAgentType} as OTHER.`,
        type: "UNKNOWN_AGENT_TYPE" as const
      };
}

function agentTypeFor(value: string): StoredAgentType {
  return knownAgentTypes.has(value as StoredAgentType) ? (value as StoredAgentType) : "OTHER";
}

function idFrom(deps: Pick<StartWorkSessionDeps, "idFactory">): string {
  return (deps.idFactory ?? randomUUID)();
}
