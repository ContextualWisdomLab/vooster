import { randomUUID } from "node:crypto";
import type { StoredRevision, StoredUseCase } from "../http/signup-types.js";
import type { BranchStore } from "../ports/branch-store.js";
import type { MembershipStore } from "../ports/membership-store.js";
import type { ProjectStore } from "../ports/project-store.js";
import type { RevisionStore } from "../ports/revision-store.js";
import type { UseCaseStore } from "../ports/usecase-store.js";

export type SyncFileDeps = {
  branchStore: BranchStore;
  idFactory?: () => string;
  membershipStore: MembershipStore;
  projectStore: ProjectStore;
  revisionStore: RevisionStore;
  useCaseStore: UseCaseStore;
};

export type SyncFileInput = {
  baseRevision: string;
  content: string;
  path: string;
};

export type SyncResult = {
  conflict_content?: string;
  current_revision: string;
  dry_run?: true;
  impact?: { entity_id: string; severity: "BREAKING" };
  path: string;
  status: "CONFLICT" | "OK" | "SKIPPED";
};

export type SyncCacheEntry = {
  path: string;
  revision: string;
  status: "SYNCED" | "UNRESOLVED";
};

export type SyncPullResult =
  | { status: "FORBIDDEN" }
  | {
      cursor: string;
      files: Array<{ content: string; path: string; revision: string }>;
      status: "PULLED";
    };

export type SyncPushResult =
  | { status: "FORBIDDEN" }
  | {
      files: Array<{ base_revision: string; path: string }>;
      status: "NETWORK_FAILURE";
    }
  | {
      cacheEntries: SyncCacheEntry[];
      results: SyncResult[];
      status: "PUSHED";
      suggestedNextActions: Array<{ command: string; reason: string }>;
    };

export async function pullSyncFiles(
  deps: Pick<SyncFileDeps, "membershipStore" | "useCaseStore">,
  input: { projectId: string; userId: string | undefined }
): Promise<SyncPullResult> {
  if (!(await authorized(deps.membershipStore, input.projectId, input.userId))) {
    return { status: "FORBIDDEN" };
  }
  const files = (await activeUseCases(deps.useCaseStore, input.projectId)).map(
    (usecase) => ({
      content: usecaseMarkdown(usecase),
      path: usecasePath(usecase),
      revision: usecase.current_revision_id
    })
  );
  return {
    cursor: files[0]?.revision ?? "",
    files,
    status: "PULLED"
  };
}

export async function pushSyncFiles(
  deps: SyncFileDeps,
  input: {
    dryRun: boolean;
    files: SyncFileInput[];
    projectId: string;
    simulateNetworkFailure: boolean;
    userId: string | undefined;
  }
): Promise<SyncPushResult> {
  if (!(await authorized(deps.membershipStore, input.projectId, input.userId))) {
    return { status: "FORBIDDEN" };
  }
  if (input.simulateNetworkFailure) {
    return {
      files: input.files.map((file) => ({
        base_revision: file.baseRevision,
        path: file.path
      })),
      status: "NETWORK_FAILURE"
    };
  }

  const results = input.dryRun
    ? await Promise.all(
        input.files.map((file) => previewFile(deps, input.projectId, file))
      )
    : await Promise.all(
        input.files.map((file) => pushFile(deps, input.projectId, file))
      );
  return {
    cacheEntries: input.dryRun ? [] : cacheEntries(results),
    results,
    status: "PUSHED",
    suggestedNextActions: suggestedSyncActions(results)
  };
}

async function authorized(
  membershipStore: MembershipStore,
  projectId: string,
  userId: string | undefined
) {
  return (
    userId !== undefined &&
    (await membershipStore.membershipForProject(projectId, userId)) !== undefined
  );
}

async function previewFile(
  deps: Pick<SyncFileDeps, "useCaseStore">,
  projectId: string,
  file: SyncFileInput
): Promise<SyncResult> {
  const usecase = await usecaseForFile(deps.useCaseStore, projectId, file.path);
  if (usecase === undefined) {
    return { current_revision: "", dry_run: true, path: file.path, status: "SKIPPED" };
  }
  if (file.baseRevision !== usecase.current_revision_id) {
    return staleFileConflict(usecase, file);
  }
  return {
    current_revision: usecase.current_revision_id,
    dry_run: true,
    path: file.path,
    status: "OK"
  };
}

async function pushFile(
  deps: SyncFileDeps,
  projectId: string,
  file: SyncFileInput
): Promise<SyncResult> {
  const usecase = await usecaseForFile(deps.useCaseStore, projectId, file.path);
  if (usecase === undefined) {
    return { current_revision: "", path: file.path, status: "SKIPPED" };
  }
  if (file.baseRevision !== usecase.current_revision_id) {
    return staleFileConflict(usecase, file);
  }

  const title = titleFrom(file.content);
  const revision = await syncRevision(deps, usecase, title);
  usecase.title = title;
  usecase.current_revision_id = revision.id;
  await deps.useCaseStore.updateUseCase(usecase);
  await deps.revisionStore.saveRevision(revision);
  await advanceMainHead(deps, projectId, usecase.id, revision.id);
  return { current_revision: revision.id, path: file.path, status: "OK" };
}

async function usecaseForFile(
  useCaseStore: UseCaseStore,
  projectId: string,
  path: string
) {
  return (await activeUseCases(useCaseStore, projectId)).find(
    (candidate) => usecasePath(candidate) === path
  );
}

async function activeUseCases(useCaseStore: UseCaseStore, projectId: string) {
  return (await useCaseStore.listUseCases(projectId)).filter(
    (usecase) => usecase.archived_at === null
  );
}

async function syncRevision(
  deps: SyncFileDeps,
  usecase: StoredUseCase,
  title: string
): Promise<StoredRevision> {
  return {
    change_summary: `Synced ${usecase.key} from file`,
    entity_id: usecase.id,
    entity_type: "USECASE",
    id: idFrom(deps),
    parent_revision_id: usecase.current_revision_id,
    severity: "NON_BREAKING",
    snapshot: { ...usecase, title },
    version_number: await deps.revisionStore.nextVersionNumber(usecase.id)
  };
}

async function advanceMainHead(
  deps: Pick<SyncFileDeps, "branchStore" | "projectStore">,
  projectId: string,
  usecaseId: string,
  revisionId: string
) {
  const project = await deps.projectStore.findProjectById(projectId);
  const branch =
    project === undefined
      ? undefined
      : await deps.branchStore.findBranchById(project.default_branch_id);
  if (branch !== undefined) {
    branch.head_revision_ids = {
      ...(branch.head_revision_ids ?? {}),
      [usecaseId]: revisionId
    };
    await deps.branchStore.updateBranch(branch);
  }
}

function cacheEntries(results: SyncResult[]): SyncCacheEntry[] {
  return results.map((result) => ({
    path: result.path,
    revision: result.current_revision,
    status: result.status === "CONFLICT" ? "UNRESOLVED" : "SYNCED"
  }));
}

function suggestedSyncActions(results: SyncResult[]) {
  return results.some((result) => result.status === "CONFLICT")
    ? conflictActions()
    : syncedActions();
}

function staleFileConflict(usecase: StoredUseCase, file: SyncFileInput): SyncResult {
  return {
    conflict_content: conflictContent(file.content, usecaseMarkdown(usecase), usecase),
    current_revision: usecase.current_revision_id,
    impact: { entity_id: usecase.id, severity: "BREAKING" },
    path: file.path,
    status: "CONFLICT"
  };
}

function conflictContent(local: string, remote: string, usecase: StoredUseCase) {
  return `<<<<<<< local\n${local}\n=======\n${remote}\n>>>>>>> remote (${usecase.current_revision_id})\n`;
}

function syncedActions() {
  return [
    {
      command: "vspec pull",
      reason: "Refresh local files after successful push."
    }
  ];
}

function conflictActions() {
  return [
    {
      command: "vspec diff",
      reason: "Inspect the server and local changes before resolving the conflict."
    },
    {
      command: "vspec push",
      reason: "Push again after removing conflict markers."
    }
  ];
}

function titleFrom(content: string) {
  const title = content.split("\n").find((line) => line.startsWith("# "));
  return title?.slice(2).trim() ?? "Untitled use case";
}

function usecaseMarkdown(usecase: StoredUseCase) {
  return `---\nvspec_format: 1\ntype: usecase\nid: ${usecase.id}\nkey: ${usecase.key}\ntitle: ${usecase.title}\nlevel: ${usecase.level}\nformat: ${usecase.format}\nstatus: ${usecase.status}\npriority: ${usecase.priority}\nscope: ${usecase.scope}\nrevision: ${usecase.current_revision_id}\n---\n\n# ${usecase.title}\n`;
}

function usecasePath(usecase: StoredUseCase) {
  return `specs/${usecase.key}.md`;
}

function idFrom(deps: SyncFileDeps): string {
  return (deps.idFactory ?? randomUUID)();
}
