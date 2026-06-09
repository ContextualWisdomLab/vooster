import type { TestServer } from "./server.js";
import type { Stakeholder } from "./uc-fixtures.js";

export type StakeholderInterest = {
  id: string;
  interest: string;
  protection_mechanism: string;
  stakeholder_id: string;
  usecase_id: string;
};

export type InterestResponse = {
  next_missing_role_hint: string;
  revision: RevisionResponse;
  stakeholder_interest: StakeholderInterest;
  stakeholder_interests: InterestListItem[];
};

export type RemoveInterestResponse = {
  removed_stakeholder_interest_id: string;
  revision: RevisionResponse;
  stakeholder_interests: InterestListItem[];
  warnings?: Array<{ message: string; type: string }>;
};

export type ProblemResponse = {
  candidate_stakeholders?: string[];
  code?: string;
  existing_interest?: string;
  suggested_next_actions: Array<{ command: string; reason: string }>;
  title: string;
};

type InterestListItem = {
  interest: StakeholderInterest;
  stakeholder: Stakeholder;
};

type RevisionResponse = {
  change_summary: string;
  entity_id: string;
  entity_type: string;
  severity: string;
  version_number: number;
};

export async function addInterest(
  server: TestServer,
  usecaseId: string,
  cookie: string,
  body: { interest: string; protection_mechanism?: string; stakeholder: string }
) {
  return server.fetch(`/v1/usecases/${usecaseId}/stakeholder-interests`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ protection_mechanism: "", ...body })
  });
}
