import {
  gherkinMissingRequiredField,
  renderGherkinFeature
} from "./gherkin-renderer.js";
import type { StoredUseCase } from "../http/signup-types.js";
import type { ActorStore } from "../ports/actor-store.js";
import type { MembershipStore } from "../ports/membership-store.js";
import type { RevisionStore } from "../ports/revision-store.js";
import type { ScenarioStore } from "../ports/scenario-store.js";
import type { StepStore } from "../ports/step-store.js";
import type { UseCaseStore } from "../ports/usecase-store.js";

export type GherkinExportDeps = {
  actorStore: ActorStore;
  membershipStore: MembershipStore;
  revisionStore: RevisionStore;
  scenarioStore: ScenarioStore;
  stepStore: StepStore;
  useCaseStore: UseCaseStore;
};

export type GherkinExportInput = {
  revisionId: string | undefined;
  usecaseId: string;
  userId: string | undefined;
};

export type GherkinExportResult =
  | { feature: string; status: "EXPORTED"; usecase: StoredUseCase }
  | { status: "FORBIDDEN" }
  | { status: "USECASE_NOT_FOUND" }
  | { status: "ARCHIVED_USECASE"; usecase: StoredUseCase }
  | { revisionId: string; status: "REVISION_NOT_FOUND"; usecase: StoredUseCase }
  | {
      missingRequiredField: "main_success" | "main_success.steps";
      status: "INCOMPLETE_USECASE";
      usecase: StoredUseCase;
    };

export async function exportGherkin(
  deps: GherkinExportDeps,
  input: GherkinExportInput
): Promise<GherkinExportResult> {
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
  if (found.usecase.archived_at !== null) {
    return { status: "ARCHIVED_USECASE", usecase: found.usecase };
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

  const missingRequiredField = await gherkinMissingRequiredField(
    deps.scenarioStore,
    deps.stepStore,
    found.usecase
  );
  if (missingRequiredField !== undefined) {
    return {
      missingRequiredField,
      status: "INCOMPLETE_USECASE",
      usecase: found.usecase
    };
  }

  return {
    feature: await renderGherkinFeature(deps, found.projectId, found.usecase),
    status: "EXPORTED",
    usecase: found.usecase
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
