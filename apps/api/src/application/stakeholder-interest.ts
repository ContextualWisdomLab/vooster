import { randomUUID } from "node:crypto";
import type {
  StoredRevision,
  StoredStakeholder,
  StoredStakeholderInterest,
  StoredUseCase
} from "../domain/entities/index.js";
import type { MembershipStore } from "../ports/membership-store.js";
import type { RevisionStore } from "../ports/revision-store.js";
import type { StakeholderInterestStore } from "../ports/stakeholder-interest-store.js";
import type { StakeholderStore } from "../ports/stakeholder-store.js";
import type { UseCaseStore } from "../ports/usecase-store.js";

type InterestListItem = {
  interest: StoredStakeholderInterest;
  stakeholder: StoredStakeholder;
};

export type StakeholderInterestDeps = {
  idFactory?: () => string;
  membershipStore: MembershipStore;
  revisionStore: RevisionStore;
  stakeholderInterestStore: StakeholderInterestStore;
  stakeholderStore: StakeholderStore;
  useCaseStore: UseCaseStore;
};

export type AddStakeholderInterestInput = {
  interest: string;
  protectionMechanism: string;
  stakeholderName: string;
  usecaseId: string;
  userId?: string;
};

export type AddStakeholderInterestResult =
  | {
      nextMissingRoleHint: string;
      revision: StoredRevision;
      stakeholderInterest: StoredStakeholderInterest;
      stakeholderInterests: InterestListItem[];
      status: "ADDED";
    }
  | { existingInterest: string; status: "DUPLICATE_INTEREST"; usecaseId: string }
  | { status: "FORBIDDEN" }
  | {
      status: "STAKEHOLDER_NOT_FOUND";
      candidateStakeholders: string[];
      stakeholderName: string;
    }
  | { status: "USECASE_NOT_FOUND" };

export type RemoveStakeholderInterestInput = {
  stakeholderInterestId: string;
  usecaseId: string;
  userId?: string;
};

export type RemoveStakeholderInterestResult =
  | {
      noStakeholderInterests: boolean;
      removedStakeholderInterestId: string;
      revision: StoredRevision;
      stakeholderInterests: InterestListItem[];
      status: "REMOVED";
    }
  | { status: "FORBIDDEN" }
  | { status: "INTEREST_NOT_FOUND" }
  | { status: "USECASE_NOT_FOUND" };

export async function addStakeholderInterest(
  deps: StakeholderInterestDeps,
  input: AddStakeholderInterestInput
): Promise<AddStakeholderInterestResult> {
  const found = await authorizedUseCase(deps, input.usecaseId, input.userId);
  if (found.status !== "AUTHORIZED") {
    return found;
  }
  const stakeholder = await activeStakeholderNamed(
    deps.stakeholderStore,
    found.projectId,
    input.stakeholderName
  );
  if (stakeholder === undefined) {
    return {
      candidateStakeholders: await stakeholderNameCandidates(
        deps.stakeholderStore,
        found.projectId,
        input.stakeholderName
      ),
      stakeholderName: input.stakeholderName,
      status: "STAKEHOLDER_NOT_FOUND"
    };
  }
  const existing =
    await deps.stakeholderInterestStore.findStakeholderInterestForStakeholder(
      found.usecase.id,
      stakeholder.id
    );
  if (existing !== undefined) {
    return {
      existingInterest: existing.interest,
      status: "DUPLICATE_INTEREST",
      usecaseId: found.usecase.id
    };
  }

  const stakeholderInterest = {
    id: idFrom(deps),
    interest: input.interest,
    protection_mechanism: input.protectionMechanism,
    stakeholder_id: stakeholder.id,
    usecase_id: found.usecase.id
  };
  await deps.stakeholderInterestStore.saveStakeholderInterest(stakeholderInterest);
  const revision = await saveRevision(
    deps,
    found.usecase,
    "NON_BREAKING",
    `Added stakeholder interest ${stakeholderInterest.id}`
  );
  const stakeholderInterests = await interestsWithStakeholders(
    deps,
    found.usecase.id,
    found.projectId
  );
  return {
    nextMissingRoleHint: missingRoleHint(stakeholderInterests),
    revision,
    stakeholderInterest,
    stakeholderInterests,
    status: "ADDED"
  };
}

export async function removeStakeholderInterest(
  deps: StakeholderInterestDeps,
  input: RemoveStakeholderInterestInput
): Promise<RemoveStakeholderInterestResult> {
  const found = await authorizedUseCase(deps, input.usecaseId, input.userId);
  if (found.status !== "AUTHORIZED") {
    return found;
  }
  const removed = await deps.stakeholderInterestStore.findStakeholderInterestById(
    found.usecase.id,
    input.stakeholderInterestId
  );
  if (removed === undefined) {
    return { status: "INTEREST_NOT_FOUND" };
  }

  await deps.stakeholderInterestStore.deleteStakeholderInterest(removed.id);
  const revision = await saveRevision(
    deps,
    found.usecase,
    "BREAKING",
    `Removed stakeholder interest ${removed.id}`
  );
  const stakeholderInterests = await interestsWithStakeholders(
    deps,
    found.usecase.id,
    found.projectId
  );
  return {
    noStakeholderInterests: stakeholderInterests.length === 0,
    removedStakeholderInterestId: removed.id,
    revision,
    stakeholderInterests,
    status: "REMOVED"
  };
}

async function authorizedUseCase(
  deps: Pick<StakeholderInterestDeps, "membershipStore" | "useCaseStore">,
  usecaseId: string,
  userId: string | undefined
): Promise<
  | { projectId: string; status: "AUTHORIZED"; usecase: StoredUseCase }
  | { status: "FORBIDDEN" | "USECASE_NOT_FOUND" }
> {
  const found = await deps.useCaseStore.findUseCaseWithProject(usecaseId);
  if (found === undefined) {
    return { status: "USECASE_NOT_FOUND" };
  }
  if (
    userId === undefined ||
    (await deps.membershipStore.membershipForProject(found.projectId, userId)) ===
      undefined
  ) {
    return { status: "FORBIDDEN" };
  }
  return { projectId: found.projectId, status: "AUTHORIZED", usecase: found.usecase };
}

async function activeStakeholderNamed(
  stakeholderStore: StakeholderStore,
  projectId: string,
  name: string
) {
  const stakeholder = await stakeholderStore.findStakeholderByName(projectId, name);
  return stakeholder?.archived_at === null ? stakeholder : undefined;
}

async function stakeholderNameCandidates(
  stakeholderStore: StakeholderStore,
  projectId: string,
  name: string
): Promise<string[]> {
  const requested = normalized(name);
  return (await stakeholderStore.listStakeholders(projectId))
    .filter((stakeholder) => stakeholder.archived_at === null)
    .filter((stakeholder) => {
      const candidate = normalized(stakeholder.name);
      return candidate.includes(requested) || requested.includes(candidate);
    })
    .map((stakeholder) => stakeholder.name);
}

async function interestsWithStakeholders(
  deps: Pick<StakeholderInterestDeps, "stakeholderInterestStore" | "stakeholderStore">,
  usecaseId: string,
  projectId: string
): Promise<InterestListItem[]> {
  const rows = await Promise.all(
    (await deps.stakeholderInterestStore.listStakeholderInterests(usecaseId)).map(
      async (interest) => ({
        interest,
        stakeholder: await deps.stakeholderStore.findStakeholderById(
          projectId,
          interest.stakeholder_id
        )
      })
    )
  );
  return rows.flatMap((row) =>
    row.stakeholder === undefined
      ? []
      : [{ interest: row.interest, stakeholder: row.stakeholder }]
  );
}

async function saveRevision(
  deps: Pick<StakeholderInterestDeps, "idFactory" | "revisionStore">,
  usecase: StoredUseCase,
  severity: StoredRevision["severity"],
  changeSummary: string
): Promise<StoredRevision> {
  const revision = {
    change_summary: changeSummary,
    entity_id: usecase.id,
    entity_type: "USECASE" as const,
    id: idFrom(deps),
    severity,
    snapshot: { ...usecase },
    version_number: await deps.revisionStore.nextVersionNumber(usecase.id)
  };
  await deps.revisionStore.saveRevision(revision);
  return revision;
}

function missingRoleHint(rows: InterestListItem[]): string {
  return rows.some(({ stakeholder }) => stakeholder.type === "REGULATORY")
    ? ""
    : "No regulatory stakeholder yet.";
}

function idFrom(deps: Pick<StakeholderInterestDeps, "idFactory">): string {
  return (deps.idFactory ?? randomUUID)();
}

function normalized(value: string): string {
  return value.trim().toLocaleLowerCase();
}
