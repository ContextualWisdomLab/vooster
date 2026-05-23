import { z } from "zod";
import type {
  StoredStakeholder,
  StoredStakeholderInterest
} from "../domain/entities/index.js";
import { problem } from "./signup-support.js";
import type { StakeholderInterestStore } from "../ports/stakeholder-interest-store.js";
import type { StakeholderStore } from "../ports/stakeholder-store.js";

export async function interestsWithStakeholders(
  stakeholderInterestStore: StakeholderInterestStore,
  stakeholderStore: StakeholderStore,
  usecaseId: string,
  projectId: string
): Promise<
  Array<{ interest: StoredStakeholderInterest; stakeholder: StoredStakeholder }>
> {
  const rows = await Promise.all(
    (await stakeholderInterestStore.listStakeholderInterests(usecaseId)).map(
      async (interest) => ({
        interest,
        stakeholder: await stakeholderStore.findStakeholderById(
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

export async function missingRoleHint(
  stakeholderInterestStore: StakeholderInterestStore,
  stakeholderStore: StakeholderStore,
  usecaseId: string,
  projectId: string
): Promise<string> {
  const hasRegulatory = (
    await interestsWithStakeholders(
      stakeholderInterestStore,
      stakeholderStore,
      usecaseId,
      projectId
    )
  ).some(({ stakeholder }) => stakeholder.type === "REGULATORY");
  return hasRegulatory ? "" : "No regulatory stakeholder yet.";
}

export function existingInterestForStakeholder(
  stakeholderInterestStore: StakeholderInterestStore,
  usecaseId: string,
  stakeholderId: string
): Promise<StoredStakeholderInterest | undefined> {
  return stakeholderInterestStore.findStakeholderInterestForStakeholder(
    usecaseId,
    stakeholderId
  );
}

export async function activeStakeholderNamed(
  stakeholderStore: StakeholderStore,
  projectId: string,
  name: string
) {
  const stakeholder = await stakeholderStore.findStakeholderByName(projectId, name);
  return stakeholder?.archived_at === null ? stakeholder : undefined;
}

export async function stakeholderNameCandidates(
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

export function unresolvedStakeholderProblem(
  candidateStakeholders: string[],
  name: string
) {
  return problem(
    422,
    "Stakeholder name does not resolve",
    {
      candidate_stakeholders: candidateStakeholders,
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
