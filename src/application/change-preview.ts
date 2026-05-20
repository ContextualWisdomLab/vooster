import { randomUUID } from "node:crypto";
import type {
  StoredLock,
  StoredMembership,
  StoredRevision,
  StoredUseCase,
  StoredWorkSession
} from "../domain/entities/index.js";
import type { LockStore } from "../ports/lock-store.js";
import type { MembershipStore } from "../ports/membership-store.js";
import type { RevisionStore } from "../ports/revision-store.js";
import type { UseCaseStore } from "../ports/usecase-store.js";
import type { WorkSessionStore } from "../ports/work-session-store.js";

export type ChangeDiff = {
  after: string;
  before: string;
  entity_id: string;
  entity_type: "USECASE";
  path: "title";
  severity: "NON_BREAKING";
};

export type ChangePreview = {
  base_revision: string;
  diff: ChangeDiff[];
  expires_at: string;
  id: string;
  severity: "NON_BREAKING";
  usecase_id: string;
};

export type PreviewAffectedSession = {
  agent_type: StoredWorkSession["agent_type"];
  id: string;
  owner: string | undefined;
  pinned_usecase_keys: string[];
};

export type ChangePreviewDeps = {
  clock?: () => Date;
  idFactory?: () => string;
  lockStore: LockStore;
  membershipStore: MembershipStore;
  readOnlyMemberships: ReadonlySet<string>;
  revisionStore: RevisionStore;
  useCaseStore: UseCaseStore;
  workSessionStore: WorkSessionStore;
};

export type ChangePreviewInput = {
  autoCommit: boolean;
  baseRevision: string;
  patch: {
    entityId: string;
    title: string;
  };
  usecaseKey: string;
  userId: string | undefined;
};

export type ChangePreviewResult =
  | { status: "USECASE_NOT_FOUND" }
  | { status: "WRITE_FORBIDDEN" }
  | { status: "PATCH_TARGET_MISMATCH" }
  | { lock: StoredLock; status: "HARD_LOCKED"; usecase: StoredUseCase }
  | {
      currentRevision: StoredRevision | undefined;
      status: "STALE_BASE";
      usecase: StoredUseCase;
    }
  | {
      affectedSessions: PreviewAffectedSession[];
      preview: ChangePreview;
      status: "PREVIEWED";
      suggestedNextActions: Array<{ command: string; reason: string }>;
      warnings: Array<{ message: string; type: "AUTO_COMMIT_REFUSED" }>;
    };

export async function previewChange(
  deps: ChangePreviewDeps,
  input: ChangePreviewInput
): Promise<ChangePreviewResult> {
  const access = await accessibleUseCaseByKey(deps, input.usecaseKey, input.userId);
  if (access === undefined) {
    return { status: "USECASE_NOT_FOUND" };
  }
  if (isReadOnlyMembership(deps, access.membership)) {
    return { status: "WRITE_FORBIDDEN" };
  }
  if (input.patch.entityId !== access.usecase.id) {
    return { status: "PATCH_TARGET_MISMATCH" };
  }

  const hardLock = await blockingHardLock(deps, access.usecase);
  if (hardLock !== undefined) {
    return { lock: hardLock, status: "HARD_LOCKED", usecase: access.usecase };
  }
  if (input.baseRevision !== access.usecase.current_revision_id) {
    return {
      currentRevision: await deps.revisionStore.findRevisionById(
        access.usecase.current_revision_id
      ),
      status: "STALE_BASE",
      usecase: access.usecase
    };
  }

  const preview = changePreview(
    deps,
    access.usecase,
    input.baseRevision,
    input.patch.title
  );
  const affectedSessions = await affectedActiveSessions(
    deps.workSessionStore,
    access.usecase
  );
  return {
    affectedSessions,
    preview,
    status: "PREVIEWED",
    suggestedNextActions: nextActions(preview, access.usecase, affectedSessions),
    warnings: input.autoCommit ? [autoCommitWarning()] : []
  };
}

async function accessibleUseCaseByKey(
  deps: Pick<ChangePreviewDeps, "membershipStore" | "useCaseStore">,
  key: string,
  userId: string | undefined
): Promise<{ membership: StoredMembership; usecase: StoredUseCase } | undefined> {
  if (userId === undefined) {
    return undefined;
  }

  for (const candidate of await deps.useCaseStore.findUseCasesByKey(key)) {
    const membership = await deps.membershipStore.membershipForProject(
      candidate.project_id,
      userId
    );
    if (membership !== undefined && candidate.archived_at === null) {
      return { membership, usecase: candidate };
    }
  }
  return undefined;
}

function isReadOnlyMembership(
  deps: Pick<ChangePreviewDeps, "readOnlyMemberships">,
  membership: StoredMembership
) {
  return deps.readOnlyMemberships.has(
    `${membership.user_id}:${membership.workspace_id}`
  );
}

async function blockingHardLock(
  deps: Pick<ChangePreviewDeps, "clock" | "lockStore">,
  usecase: StoredUseCase
) {
  const lock = await deps.lockStore.findLockForUseCase(usecase.id);
  return lock?.mode === "HARD" && Date.parse(lock.expires_at) > now(deps).getTime()
    ? lock
    : undefined;
}

function changePreview(
  deps: ChangePreviewDeps,
  usecase: StoredUseCase,
  baseRevision: string,
  title: string
): ChangePreview {
  return {
    base_revision: baseRevision,
    diff: [
      {
        after: title,
        before: usecase.title,
        entity_id: usecase.id,
        entity_type: "USECASE",
        path: "title",
        severity: "NON_BREAKING"
      }
    ],
    expires_at: new Date(now(deps).getTime() + 15 * 60_000).toISOString(),
    id: idFrom(deps),
    severity: "NON_BREAKING",
    usecase_id: usecase.id
  };
}

async function affectedActiveSessions(
  workSessionStore: WorkSessionStore,
  usecase: StoredUseCase
): Promise<PreviewAffectedSession[]> {
  return (await workSessionStore.listWorkSessionsForUseCase(usecase.id))
    .filter((session) => session.status === "ACTIVE")
    .map((session) => ({
      agent_type: session.agent_type,
      id: session.id,
      owner: session.user_id,
      pinned_usecase_keys: [usecase.key]
    }));
}

function nextActions(
  preview: ChangePreview,
  usecase: StoredUseCase,
  affectedSessions: PreviewAffectedSession[]
) {
  return [
    {
      command: `vspec change commit --preview-id ${preview.id}`,
      reason: "Commit the preview after human review."
    },
    ...(affectedSessions.length === 0
      ? []
      : [
          {
            command: `vspec who ${usecase.key}`,
            reason: "Coordinate with active sessions before committing."
          }
        ])
  ];
}

function autoCommitWarning() {
  return {
    message: "NON_BREAKING changes require explicit human commit.",
    type: "AUTO_COMMIT_REFUSED" as const
  };
}

function now(deps: Pick<ChangePreviewDeps, "clock">) {
  return (deps.clock ?? (() => new Date()))();
}

function idFrom(deps: Pick<ChangePreviewDeps, "idFactory">) {
  return (deps.idFactory ?? randomUUID)();
}
