import { randomUUID } from "node:crypto";
import type { StoredRevision, StoredStakeholder } from "../domain/entities/index.js";
import type { ProjectStore } from "../ports/project-store.js";
import type { RevisionStore } from "../ports/revision-store.js";
import type { StakeholderStore } from "../ports/stakeholder-store.js";
import type { WorkspaceStore } from "../ports/workspace-store.js";

const stakeholderTypes = ["INTERNAL", "EXTERNAL", "REGULATORY"] as const;
export type StakeholderType = (typeof stakeholderTypes)[number];

export type StakeholderDeps = {
  idFactory?: () => string;
  projectStore: ProjectStore;
  revisionStore: RevisionStore;
  stakeholderStore: StakeholderStore;
  workspaceStore: WorkspaceStore;
};

export type CreateStakeholderInput = {
  attachToStep: boolean;
  description: string;
  dryRun?: boolean;
  name: string;
  projectId: string;
  type: string;
};

export type CreateStakeholderResult =
  | {
      revision: StoredRevision;
      stakeholder: StoredStakeholder;
      status: "CREATED";
    }
  | { status: "WORKSPACE_ARCHIVED" }
  | { status: "ACTOR_REQUIRED_FOR_STEPS" }
  | { status: "INVALID_TYPE"; validTypes: StakeholderType[] }
  | { existingStakeholder: StoredStakeholder; status: "DUPLICATE_NAME" };

export async function createStakeholder(
  deps: StakeholderDeps,
  input: CreateStakeholderInput
): Promise<CreateStakeholderResult> {
  if (await projectWorkspaceArchived(deps, input.projectId)) {
    return { status: "WORKSPACE_ARCHIVED" };
  }
  if (input.attachToStep) {
    return { status: "ACTOR_REQUIRED_FOR_STEPS" };
  }
  if (!isStakeholderType(input.type)) {
    return { status: "INVALID_TYPE", validTypes: [...stakeholderTypes] };
  }

  const existing = await activeStakeholderNamed(
    deps.stakeholderStore,
    input.projectId,
    input.name
  );
  if (existing !== undefined) {
    return { existingStakeholder: existing, status: "DUPLICATE_NAME" };
  }

  const stakeholder = newStakeholder(deps, input, input.type);
  const revision = initialRevision(deps, stakeholder);
  if (input.dryRun !== true) {
    await deps.stakeholderStore.saveStakeholder(stakeholder);
    await deps.revisionStore.saveRevision(revision);
  }
  return { revision, stakeholder, status: "CREATED" };
}

function newStakeholder(
  deps: StakeholderDeps,
  input: CreateStakeholderInput,
  type: StakeholderType
): StoredStakeholder {
  return {
    archived_at: null,
    description: input.description,
    id: id(deps),
    name: input.name,
    project_id: input.projectId,
    type
  };
}

function initialRevision(
  deps: StakeholderDeps,
  stakeholder: StoredStakeholder
): StoredRevision {
  return {
    entity_id: stakeholder.id,
    entity_type: "STAKEHOLDER",
    id: id(deps),
    snapshot: stakeholder,
    version_number: 1
  };
}

function isStakeholderType(type: string): type is StakeholderType {
  return stakeholderTypes.includes(type as StakeholderType);
}

async function activeStakeholderNamed(
  stakeholderStore: StakeholderStore,
  projectId: string,
  name: string
) {
  const stakeholder = await stakeholderStore.findStakeholderByName(projectId, name);
  return stakeholder?.archived_at === null ? stakeholder : undefined;
}

async function projectWorkspaceArchived(
  deps: Pick<StakeholderDeps, "projectStore" | "workspaceStore">,
  projectId: string
): Promise<boolean> {
  const project = await deps.projectStore.findProjectById(projectId);
  return (
    project !== undefined &&
    (await deps.workspaceStore.isWorkspaceArchived(project.workspace_id))
  );
}

function id(deps: StakeholderDeps): string {
  return (deps.idFactory ?? randomUUID)();
}
