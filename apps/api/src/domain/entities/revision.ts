import type { StoredActor } from "./actor.js";
import type { StoredGoal } from "./goal.js";
import type { StoredStakeholder } from "./stakeholder.js";
import type { StoredUseCase } from "./use-case.js";

export type StoredRevision = {
  id: string;
  entity_type: "ACTOR" | "GOAL" | "STAKEHOLDER" | "USECASE";
  entity_id: string;
  version_number: number;
  snapshot: StoredActor | StoredGoal | StoredStakeholder | StoredUseCase;
  change_summary?: string;
  branch_id?: string;
  parent_revision_id?: string;
  severity?: "BREAKING" | "COSMETIC" | "NON_BREAKING";
};
