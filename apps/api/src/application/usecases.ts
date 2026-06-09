import { randomUUID } from "node:crypto";
import type {
  StoredProject,
  StoredRevision,
  StoredUseCase
} from "../domain/entities/index.js";
import type { ActorStore } from "../ports/actor-store.js";
import type { MembershipStore } from "../ports/membership-store.js";
import type { ProjectStore } from "../ports/project-store.js";
import type { RevisionStore } from "../ports/revision-store.js";
import type { StakeholderInterestStore } from "../ports/stakeholder-interest-store.js";
import type { UseCaseStore } from "../ports/usecase-store.js";
import { titleLooksLikeVerbPhrase, verbPhraseOffendingWord } from "./verb-phrases.js";

export type UseCaseAuthoringDeps = {
  actorStore: ActorStore;
  idFactory?: () => string;
  membershipStore: MembershipStore;
  projectStore: ProjectStore;
  revisionStore: RevisionStore;
  useCaseStore: UseCaseStore;
};

export type UseCaseAuthoringInput = {
  dryRun?: boolean;
  force: boolean;
  level: StoredUseCase["level"];
  primaryActor: string;
  priority: StoredUseCase["priority"];
  projectId: string;
  scope: string | undefined;
  simulateKeyCollisionOnce: boolean;
  title: string;
  userId: string | undefined;
};

export type UseCaseAuthoringResult =
  | { status: "FORBIDDEN" }
  | {
      offendingWord: string;
      status: "TITLE_NOT_VERB_PHRASE";
      suggestedTitles: string[];
    }
  | { status: "PROJECT_NOT_FOUND" }
  | { actorName: string; status: "PRIMARY_ACTOR_NOT_AVAILABLE" }
  | {
      revision: StoredRevision;
      status: "CREATED";
      suggestedNextActions: Array<{ command: string; reason: string }>;
      usecase: StoredUseCase;
    };

export type UseCaseUpdateDeps = {
  membershipStore: MembershipStore;
  stakeholderInterestStore: StakeholderInterestStore;
  useCaseStore: UseCaseStore;
};

export type UseCaseMetadataChanges = Partial<
  Pick<StoredUseCase, "format" | "level" | "priority" | "scope" | "status" | "title">
>;

export type UseCaseUpdateInput = {
  changes?: UseCaseMetadataChanges;
  status?: StoredUseCase["status"];
  usecaseId: string;
  userId: string | undefined;
};

export type UseCaseUpdateResult =
  | { status: "USECASE_NOT_FOUND" }
  | { status: "FORBIDDEN" }
  | { status: "NEEDS_STAKEHOLDER_INTEREST" }
  | { status: "UPDATED"; usecase: StoredUseCase };

export async function authorUseCase(
  deps: UseCaseAuthoringDeps,
  input: UseCaseAuthoringInput
): Promise<UseCaseAuthoringResult> {
  if (
    input.userId === undefined ||
    (await deps.membershipStore.membershipForProject(input.projectId, input.userId)) ===
      undefined
  ) {
    return { status: "FORBIDDEN" };
  }
  if (!input.force && !titleLooksLikeVerbPhrase(input.title)) {
    return {
      offendingWord: verbPhraseOffendingWord(input.title),
      status: "TITLE_NOT_VERB_PHRASE",
      suggestedTitles: suggestedTitles(input.title)
    };
  }

  const project = await deps.projectStore.findProjectById(input.projectId);
  if (project === undefined) {
    return { status: "PROJECT_NOT_FOUND" };
  }
  const actor = await deps.actorStore.findActorByName(
    input.projectId,
    input.primaryActor
  );
  if (actor === undefined || actor.archived_at !== null) {
    return {
      actorName: input.primaryActor,
      status: "PRIMARY_ACTOR_NOT_AVAILABLE"
    };
  }

  const usecase = await seededUseCase(deps, input, project, actor.id);
  const revision = useCaseRevision(deps, usecase);
  usecase.current_revision_id = revision.id;
  revision.snapshot = { ...usecase };

  if (input.dryRun !== true) {
    await deps.useCaseStore.saveUseCase(usecase);
    await deps.revisionStore.saveRevision(revision);
  }

  return {
    revision,
    status: "CREATED",
    suggestedNextActions: useCaseNextActions(usecase.key),
    usecase
  };
}

export async function updateUseCaseMetadata(
  deps: UseCaseUpdateDeps,
  input: UseCaseUpdateInput
): Promise<UseCaseUpdateResult> {
  const changes = useCaseMetadataChanges(input);
  const found = await deps.useCaseStore.findUseCaseWithProject(input.usecaseId);
  if (found === undefined) {
    return { status: "USECASE_NOT_FOUND" };
  }
  if (
    input.userId === undefined ||
    (await deps.membershipStore.membershipForProject(found.projectId, input.userId)) ===
      undefined
  ) {
    return { status: "FORBIDDEN" };
  }
  if (
    changes.status !== undefined &&
    changes.status !== "DRAFT" &&
    (await deps.stakeholderInterestStore.listStakeholderInterests(found.usecase.id))
      .length === 0
  ) {
    return { status: "NEEDS_STAKEHOLDER_INTEREST" };
  }

  const usecase = { ...found.usecase, ...changes };
  await deps.useCaseStore.updateUseCase(usecase);
  return { status: "UPDATED", usecase };
}

async function seededUseCase(
  deps: UseCaseAuthoringDeps,
  input: UseCaseAuthoringInput,
  project: StoredProject,
  actorId: string
): Promise<StoredUseCase> {
  return {
    archived_at: null,
    current_revision_id: "",
    format: "BRIEF",
    id: idFrom(deps),
    key: await nextUseCaseKey(
      deps.useCaseStore,
      project.id,
      project.key,
      input.simulateKeyCollisionOnce ? 1 : 0
    ),
    level: input.level,
    primary_actor_id: actorId,
    priority: input.priority,
    project_id: input.projectId,
    scope: input.scope ?? project.key.toLowerCase(),
    status: "DRAFT",
    title: input.title
  };
}

async function nextUseCaseKey(
  useCaseStore: UseCaseStore,
  projectId: string,
  projectKey: string,
  skipCount = 0
): Promise<string> {
  const nextNumber =
    (await useCaseStore.listUseCases(projectId)).length + 1 + skipCount;
  return `${projectKey}-${String(nextNumber).padStart(3, "0")}`;
}

function useCaseRevision(
  deps: UseCaseAuthoringDeps,
  usecase: StoredUseCase
): StoredRevision {
  return {
    entity_id: usecase.id,
    entity_type: "USECASE",
    id: idFrom(deps),
    snapshot: { ...usecase },
    version_number: 1
  };
}

function useCaseNextActions(key: string) {
  return [
    { command: `vspec usecase show ${key}`, reason: "Open the new use case." },
    {
      command: "vspec usecase add-stakeholder",
      reason: "Attach stakeholders and interests."
    },
    { command: "vspec scenario add", reason: "Write the main success scenario." }
  ];
}

function suggestedTitles(title: string): string[] {
  if (/[가-힣]/u.test(title)) {
    return [`${title}를 검토한다`];
  }
  return [`Review ${title.charAt(0).toLowerCase()}${title.slice(1)}`];
}

function useCaseMetadataChanges(input: UseCaseUpdateInput): UseCaseMetadataChanges {
  return {
    ...(input.status === undefined ? {} : { status: input.status }),
    ...(input.changes ?? {})
  };
}

function idFrom(deps: UseCaseAuthoringDeps): string {
  return (deps.idFactory ?? randomUUID)();
}
