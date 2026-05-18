import { z } from "zod";
import type {
  SignupState,
  StoredStakeholder,
  StoredStakeholderInterest
} from "./signup-types.js";

export function interestsWithStakeholders(
  state: SignupState,
  usecaseId: string,
  projectId: string
) {
  return (state.stakeholderInterestsByUseCaseId.get(usecaseId) ?? []).flatMap(
    (interest) => {
      const stakeholder = stakeholderWithId(state, projectId, interest.stakeholder_id);
      return stakeholder === undefined ? [] : [{ interest, stakeholder }];
    }
  );
}

export function missingRoleHint(
  state: SignupState,
  usecaseId: string,
  projectId: string
): string {
  const hasRegulatory = interestsWithStakeholders(state, usecaseId, projectId).some(
    ({ stakeholder }) => stakeholder.type === "REGULATORY"
  );
  return hasRegulatory ? "" : "No regulatory stakeholder yet.";
}

export function existingInterestForStakeholder(
  state: SignupState,
  usecaseId: string,
  stakeholderId: string
): StoredStakeholderInterest | undefined {
  return (state.stakeholderInterestsByUseCaseId.get(usecaseId) ?? []).find(
    (interest) => interest.stakeholder_id === stakeholderId
  );
}

export function activeStakeholderNamed(
  state: SignupState,
  projectId: string,
  name: string
): StoredStakeholder | undefined {
  return (state.stakeholdersByProjectId.get(projectId) ?? []).find(
    (stakeholder) => stakeholder.name === name && stakeholder.archived_at === null
  );
}

export function usecaseIdFrom(params: unknown): string {
  return z.object({ usecaseId: z.string().min(1) }).parse(params).usecaseId;
}

function stakeholderWithId(
  state: SignupState,
  projectId: string,
  stakeholderId: string
): StoredStakeholder | undefined {
  return (state.stakeholdersByProjectId.get(projectId) ?? []).find(
    (stakeholder) => stakeholder.id === stakeholderId
  );
}
