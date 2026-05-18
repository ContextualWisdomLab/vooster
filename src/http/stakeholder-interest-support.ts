import { z } from "zod";
import type {
  SignupState,
  StoredStakeholder,
  StoredStakeholderInterest
} from "./signup-types.js";
import { problem } from "./signup-support.js";

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

export function stakeholderNameCandidates(
  state: SignupState,
  projectId: string,
  name: string
): string[] {
  const requested = normalized(name);
  return (state.stakeholdersByProjectId.get(projectId) ?? [])
    .filter((stakeholder) => stakeholder.archived_at === null)
    .filter((stakeholder) => {
      const candidate = normalized(stakeholder.name);
      return candidate.includes(requested) || requested.includes(candidate);
    })
    .map((stakeholder) => stakeholder.name);
}

export function unresolvedStakeholderProblem(
  state: SignupState,
  projectId: string,
  name: string
) {
  return problem(
    422,
    "Stakeholder name does not resolve",
    {
      candidate_stakeholders: stakeholderNameCandidates(state, projectId, name),
      stakeholder_name: name
    },
    [
      {
        command: "vspec stakeholder create",
        reason: "Create the stakeholder before adding an interest."
      }
    ]
  );
}

export function usecaseIdFrom(params: unknown): string {
  return z.object({ usecaseId: z.string().min(1) }).parse(params).usecaseId;
}

function normalized(value: string): string {
  return value.trim().toLocaleLowerCase();
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
