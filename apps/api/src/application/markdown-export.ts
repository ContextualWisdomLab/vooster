import { hasMainSteps, renderMarkdown } from "./markdown-renderer.js";
import type { StoredUseCase } from "../domain/entities/index.js";
import type { ActorStore } from "../ports/actor-store.js";
import type { MembershipStore } from "../ports/membership-store.js";
import type { RevisionStore } from "../ports/revision-store.js";
import type { ScenarioStore } from "../ports/scenario-store.js";
import type { StakeholderInterestStore } from "../ports/stakeholder-interest-store.js";
import type { StakeholderStore } from "../ports/stakeholder-store.js";
import type { StepStore } from "../ports/step-store.js";
import type { UseCaseStore } from "../ports/usecase-store.js";

export type MarkdownExportDeps = {
  actorStore: ActorStore;
  membershipStore: MembershipStore;
  revisionStore: RevisionStore;
  scenarioStore: ScenarioStore;
  stakeholderInterestStore: StakeholderInterestStore;
  stakeholderStore: StakeholderStore;
  stepStore: StepStore;
  useCaseStore: UseCaseStore;
};

export type MarkdownExportInput = {
  revisionId: string | undefined;
  usecaseId: string;
  userId: string | undefined;
};

export type MarkdownExportResult =
  | { markdown: string; status: "EXPORTED" }
  | { status: "FORBIDDEN" }
  | { revisionId: string; status: "REVISION_NOT_FOUND"; usecase: StoredUseCase }
  | { status: "INCOMPLETE_USECASE"; usecase: StoredUseCase }
  | { status: "USECASE_NOT_FOUND" };

export async function exportMarkdown(
  deps: MarkdownExportDeps,
  input: MarkdownExportInput
): Promise<MarkdownExportResult> {
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
    input.revisionId !== undefined &&
    !(await hasRevision(deps.revisionStore, found.usecase, input.revisionId))
  ) {
    return {
      revisionId: input.revisionId,
      status: "REVISION_NOT_FOUND",
      usecase: found.usecase
    };
  }
  if (!(await hasMainSteps(deps.scenarioStore, deps.stepStore, found.usecase))) {
    return { status: "INCOMPLETE_USECASE", usecase: found.usecase };
  }
  return {
    markdown: await renderMarkdown(deps, found.projectId, found.usecase),
    status: "EXPORTED"
  };
}

async function hasRevision(
  revisionStore: RevisionStore,
  usecase: StoredUseCase,
  revisionId: string
) {
  return (await revisionStore.listRevisions(usecase.id)).some(
    (revision) => revision.id === revisionId
  );
}
